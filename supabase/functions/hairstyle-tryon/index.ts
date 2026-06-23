// Sif: AI hair try-on (Spike 1 + effects).
//
// Proxies Perfect Corp's YouCam hair APIs so the API key never reaches the
// client, and stores generated results in our private `tryon-photos` bucket.
// One function fans out across the hair suite by `kind`:
//   hairstyle | color | bangs | extension | volume | wavy
//
// POST { action: 'styles', kind, startingToken? }
//   -> the template library for a template-based effect (paginated).
// POST { action: 'create', kind, selfiePath, source?, templateId?, refPath?, color?, styleLabel? }
//   -> runs the effect: pushes the selfie (and optional reference) to the
//      provider's File API, creates + polls the task, stores the result, and
//      returns { id, status, resultPath } (or { status: 'failed', error }).
//
// Deploy:  supabase functions deploy hairstyle-tryon --use-api --project-ref <ref>
// Secrets: supabase secrets set PERFECTCORP_API_KEY=...

import { corsHeaders, getAdmin, getUserId, json } from '../_shared/util.ts';

const API_BASE = 'https://yce-api-01.makeupar.com';
const BUCKET = 'tryon-photos';
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // ~60s ceiling

type EffectKind = 'hairstyle' | 'color' | 'bangs' | 'extension' | 'volume' | 'wavy';
type EffectType = 'template' | 'color';

// Per-effect API routing. All slugs verified against the YouCam API docs.
const EFFECTS: Record<EffectKind, { ver: string; slug: string; type: EffectType }> = {
  hairstyle: { ver: 'v2.1', slug: 'hair-transfer', type: 'template' },
  color: { ver: 'v2.0', slug: 'hair-color', type: 'color' },
  bangs: { ver: 'v2.0', slug: 'hair-bang', type: 'template' },
  extension: { ver: 'v2.0', slug: 'hair-ext', type: 'template' },
  volume: { ver: 'v2.0', slug: 'hair-vol', type: 'template' },
  wavy: { ver: 'v2.0', slug: 'hair-curl', type: 'template' },
};

const fileEndpoint = (e: { ver: string; slug: string }) => `${API_BASE}/s2s/${e.ver}/file/${e.slug}`;
const taskEndpoint = (e: { ver: string; slug: string }) => `${API_BASE}/s2s/${e.ver}/task/${e.slug}`;
const templateEndpoint = (e: { ver: string; slug: string }) =>
  `${API_BASE}/s2s/${e.ver}/task/template/${e.slug}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${Deno.env.get('PERFECTCORP_API_KEY') ?? ''}`,
    'content-type': 'application/json',
  };
}

function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

/**
 * Upload an image stored in our private bucket directly to a YouCam feature's
 * File API and return the resulting file_id. Direct byte upload is more
 * reliable than asking the provider to fetch a signed URL.
 */
// deno-lint-ignore no-explicit-any
async function uploadToProvider(admin: any, path: string, effect: { ver: string; slug: string }): Promise<string> {
  const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !blob) throw new Error('read_failed');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const contentType =
    blob.type && blob.type !== 'application/octet-stream' ? blob.type : contentTypeFor(path);
  const fileName = path.split('/').pop() || 'image.jpg';

  const initRes = await fetch(fileEndpoint(effect), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const initJson = await initRes.json().catch(() => ({}));
  const file = initJson?.data?.files?.[0];
  const req = file?.requests?.[0];
  if (!initRes.ok || !file?.file_id || !req?.url) {
    console.error('provider file init failed:', initRes.status, initJson);
    throw new Error('file_init_failed');
  }
  const putRes = await fetch(req.url, {
    method: req.method ?? 'PUT',
    headers: req.headers ?? { 'Content-Type': contentType },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!putRes.ok) {
    console.error('provider file upload failed:', putRes.status);
    throw new Error('file_put_failed');
  }
  return file.file_id as string;
}

type ColorParams = {
  hex?: string;
  preset?: string;
  intensity?: number; // 0..100
  shine?: number; // 0..100
  pattern?: 'full' | 'ombre';
  blendStrength?: number;
  coloringSection?: 'top' | 'bottom';
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

// Build the hair-color task body from the client's color choice, per the S2S
// hair-color contract (docs.perfectcorp.com/reference/ai_hair_color):
//   - A `preset` (named colour) takes priority over a custom palette.
//   - `pattern` is REQUIRED when no preset is given. `pattern.name` is
//     "full" (one palette) or "ombre" (two palettes).
//   - Palette fields are snake_case: color / color_intensity / shine_intensity.
//   - For ombre, `coloring_section` only accepts "top".
function colorTaskBody(srcFileId: string, c: ColorParams): Record<string, unknown> {
  if (c.preset) return { src_file_id: srcFileId, preset: c.preset };

  const intensity = clamp(c.intensity ?? 100, 0, 100);
  const shine = clamp(c.shine ?? 50, 0, 100);
  const main = { color: c.hex ?? '#000000', color_intensity: intensity, shine_intensity: shine };

  if (c.pattern === 'ombre') {
    // The UI supplies one colour; root with a natural near-black so the chosen
    // colour reads as the ombre ends. Ombre needs exactly two palettes.
    const root = { color: '#1C1C1C', color_intensity: 80, shine_intensity: shine };
    return {
      src_file_id: srcFileId,
      pattern: {
        name: 'ombre',
        blend_strength: clamp(c.blendStrength ?? 80, 0, 100),
        line_offset: 0.5,
        coloring_section: 'top',
      },
      palettes: [main, root],
    };
  }

  // Full (solid) mode: pattern "full" with a single palette.
  return { src_file_id: srcFileId, pattern: { name: 'full' }, palettes: [main] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = getAdmin();

  try {
    if (!Deno.env.get('PERFECTCORP_API_KEY')) {
      return json({ error: 'Try-on is not configured yet.' }, 503);
    }

    const uid = await getUserId(req, admin);
    if (!uid) return json({ error: 'Not authenticated.' }, 401);

    let body: {
      action?: string;
      kind?: EffectKind;
      selfiePath?: string;
      source?: 'template' | 'reference';
      templateId?: string;
      refPath?: string;
      styleLabel?: string;
      color?: ColorParams;
      startingToken?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      // empty body — defaults applied below
    }

    const action = body.action ?? 'create';
    const kind: EffectKind = body.kind ?? 'hairstyle';
    const effect = EFFECTS[kind];
    if (!effect) return json({ error: 'Unknown effect.' }, 400);

    // ---- List a template-based effect's library (paginated) ----
    if (action === 'styles') {
      if (effect.type !== 'template') return json({ data: [], nextToken: null });
      const params = new URLSearchParams({ page_size: '20' });
      if (body.startingToken) params.set('starting_token', body.startingToken);
      const res = await fetch(`${templateEndpoint(effect)}?${params.toString()}`, {
        headers: apiHeaders(),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('hairstyle-tryon styles error:', res.status, payload);
        return json({ error: 'Could not load styles.' }, 502);
      }
      const data = payload?.data ?? payload;
      const nextToken = data?.next_starting_token ?? data?.starting_token ?? payload?.next_starting_token ?? null;
      return json({ data, nextToken });
    }

    // ---- Create a try-on task ----
    if (action !== 'create') return json({ error: 'Unknown action.' }, 400);

    const consent = await admin
      .from('profiles')
      .select('tryon_consent_at')
      .eq('id', uid)
      .maybeSingle();
    if (!consent.data?.tryon_consent_at) {
      return json({ error: 'Consent is required before using try-on.' }, 403);
    }

    const { selfiePath, source, templateId, refPath, styleLabel, color } = body;
    if (!selfiePath) return json({ error: 'Missing selfie.' }, 400);

    const usesReference = kind === 'hairstyle' && source === 'reference';
    if (effect.type === 'color') {
      if (!color?.hex && !color?.preset) return json({ error: 'Missing color.' }, 400);
    } else if (usesReference) {
      if (!refPath) return json({ error: 'Missing reference photo.' }, 400);
    } else if (!templateId) {
      return json({ error: 'Missing style.' }, 400);
    }

    const { data: row, error: insErr } = await admin
      .from('hairstyle_tryons')
      .insert({
        user_id: uid,
        status: 'processing',
        kind,
        source: effect.type === 'color' ? 'color' : usesReference ? 'reference' : 'template',
        style_label: styleLabel ?? '',
        template_id: effect.type === 'template' && !usesReference ? templateId : null,
        selfie_path: selfiePath,
        ref_path: usesReference ? refPath : null,
        params: effect.type === 'color' ? (color ?? {}) : {},
      })
      .select('id')
      .single();
    if (insErr || !row) {
      console.error('hairstyle-tryon insert error:', insErr);
      return json({ error: 'Could not start try-on.' }, 500);
    }
    const tryonId = row.id as string;

    const fail = async (message: string, providerTaskId?: string) => {
      await admin
        .from('hairstyle_tryons')
        .update({ status: 'failed', error: message, provider_task_id: providerTaskId ?? null, updated_at: new Date().toISOString() })
        .eq('id', tryonId);
      return json({ id: tryonId, status: 'failed', error: message });
    };

    // 1) Push the image(s) to the provider's File API.
    let srcFileId: string;
    let refFileId: string | null = null;
    try {
      srcFileId = await uploadToProvider(admin, selfiePath, effect);
      if (usesReference) refFileId = await uploadToProvider(admin, refPath!, effect);
    } catch (e) {
      console.error('provider upload error:', e);
      return await fail('Could not upload your photo to the styler. Please try another photo.');
    }

    // 2) Create the task (body depends on the effect kind).
    let taskBody: Record<string, unknown>;
    if (effect.type === 'color') {
      taskBody = colorTaskBody(srcFileId, color ?? {});
    } else if (usesReference) {
      taskBody = { src_file_id: srcFileId, ref_file_id: refFileId };
    } else {
      taskBody = { src_file_id: srcFileId, template_id: templateId };
    }
    const taskRes = await fetch(taskEndpoint(effect), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(taskBody),
    });
    const taskJson = await taskRes.json().catch(() => ({}));
    const taskId = taskJson?.data?.task_id as string | undefined;
    if (!taskRes.ok || !taskId) {
      console.error('hairstyle-tryon task error:', taskRes.status, taskJson);
      return await fail('Could not generate this look. Please try a different photo.');
    }
    await admin
      .from('hairstyle_tryons')
      .update({ provider_task_id: taskId, updated_at: new Date().toISOString() })
      .eq('id', tryonId);

    // 3) Poll for the result.
    let resultUrl: string | null = null;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const pollRes = await fetch(`${taskEndpoint(effect)}/${taskId}`, { headers: apiHeaders() });
      const pollJson = await pollRes.json().catch(() => ({}));
      const status = pollJson?.data?.task_status ?? pollJson?.task_status;
      if (status === 'success') {
        resultUrl = pollJson?.data?.results?.url ?? pollJson?.data?.result?.url ?? null;
        break;
      }
      if (status === 'error') {
        const code = pollJson?.data?.error ?? 'error';
        return await fail(`Generation failed (${code}).`, taskId);
      }
    }
    if (!resultUrl) return await fail('This look took too long to generate. Please try again.', taskId);

    // 4) Download the result and store it in our private bucket.
    const imgRes = await fetch(resultUrl);
    if (!imgRes.ok) return await fail('Could not retrieve the generated image.', taskId);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const resultPath = `${uid}/${tryonId}/result.jpg`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(resultPath, bytes, { contentType: 'image/jpeg', upsert: true });
    if (upErr) {
      console.error('hairstyle-tryon upload error:', upErr);
      return await fail('Could not save the generated image.', taskId);
    }

    await admin
      .from('hairstyle_tryons')
      .update({ status: 'succeeded', result_path: resultPath, updated_at: new Date().toISOString() })
      .eq('id', tryonId);

    return json({ id: tryonId, status: 'succeeded', resultPath });
  } catch (err) {
    console.error('hairstyle-tryon error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
