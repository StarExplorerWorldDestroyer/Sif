// Sif: AI hairstyle try-on (Spike 1).
//
// Proxies Perfect Corp's YouCam "AI Hairstyle Generator" API so the API key
// never reaches the client, and stores the generated result in our private
// `tryon-photos` bucket.
//
// POST { action: 'styles' }
//   -> returns the predefined hairstyle template library.
// POST { action: 'create', selfiePath, source, templateId?, refPath? }
//   -> runs a try-on: signs the user's selfie (and optional reference photo),
//      creates the AI task, polls until done, stores the result, and returns
//      { id, status, resultPath } (or { status: 'failed', error }).
//
// Deploy:  supabase functions deploy hairstyle-tryon
// Secrets: supabase secrets set PERFECTCORP_API_KEY=...
//          (find the key at https://yce.makeupar.com/api-console/en/api-keys/)
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { corsHeaders, getAdmin, getUserId, json } from '../_shared/util.ts';

const API_BASE = 'https://yce-api-01.makeupar.com';
const BUCKET = 'tryon-photos';
const SIGNED_TTL = 600; // 10 min — long enough for Perfect Corp to fetch the input
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // ~60s ceiling

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${Deno.env.get('PERFECTCORP_API_KEY') ?? ''}`,
    'content-type': 'application/json',
  };
}

// deno-lint-ignore no-explicit-any
async function signPath(admin: any, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
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
      selfiePath?: string;
      source?: 'template' | 'reference';
      templateId?: string;
      refPath?: string;
      styleLabel?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      // empty body — treated as the default action below
    }

    const action = body.action ?? 'create';

    // ---- List the predefined hairstyle templates ----
    if (action === 'styles') {
      // page_size is capped at 20 by the provider; larger values 400.
      const res = await fetch(
        `${API_BASE}/s2s/v2.1/task/template/hair-transfer?page_size=20`,
        { headers: apiHeaders(), signal: AbortSignal.timeout(20000) },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('hairstyle-tryon styles error:', res.status, payload);
        return json({ error: 'Could not load styles.' }, 502);
      }
      return json({ data: payload?.data ?? payload });
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

    const { selfiePath, source, templateId, refPath, styleLabel } = body;
    if (!selfiePath || (source !== 'template' && source !== 'reference')) {
      return json({ error: 'Missing selfie or style.' }, 400);
    }
    if (source === 'template' && !templateId) return json({ error: 'Missing style.' }, 400);
    if (source === 'reference' && !refPath) return json({ error: 'Missing reference photo.' }, 400);

    // Selfie/reference live in a private bucket; Perfect Corp fetches them via
    // short-lived signed URLs.
    const srcUrl = await signPath(admin, selfiePath);
    if (!srcUrl) return json({ error: 'Could not read selfie.' }, 400);
    let refUrl: string | null = null;
    if (source === 'reference') {
      refUrl = await signPath(admin, refPath!);
      if (!refUrl) return json({ error: 'Could not read reference photo.' }, 400);
    }

    const { data: row, error: insErr } = await admin
      .from('hairstyle_tryons')
      .insert({
        user_id: uid,
        status: 'processing',
        source,
        style_label: styleLabel ?? '',
        template_id: source === 'template' ? templateId : null,
        selfie_path: selfiePath,
        ref_path: source === 'reference' ? refPath : null,
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

    // 1) Create the task.
    const taskBody = source === 'template'
      ? { src_file_url: srcUrl, template_id: templateId }
      : { src_file_url: srcUrl, ref_file_url: refUrl };
    const taskRes = await fetch(`${API_BASE}/s2s/v2.1/task/hair-transfer`, {
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

    // 2) Poll for the result.
    let resultUrl: string | null = null;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const pollRes = await fetch(`${API_BASE}/s2s/v2.1/task/hair-transfer/${taskId}`, {
        headers: apiHeaders(),
      });
      const pollJson = await pollRes.json().catch(() => ({}));
      const status = pollJson?.data?.task_status ?? pollJson?.task_status;
      if (status === 'success') {
        resultUrl = pollJson?.data?.results?.url ?? null;
        break;
      }
      if (status === 'error') {
        const code = pollJson?.data?.error ?? 'error';
        return await fail(`Generation failed (${code}).`, taskId);
      }
    }
    if (!resultUrl) return await fail('This look took too long to generate. Please try again.', taskId);

    // 3) Download the result and store it in our private bucket.
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
