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
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // ~60s ceiling

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
 * Upload an image stored in our private bucket directly to Perfect Corp via
 * their File API and return the resulting file_id. This is more reliable than
 * handing them a signed URL to fetch (which can fail with error_download_image).
 */
// deno-lint-ignore no-explicit-any
async function uploadToProvider(admin: any, path: string): Promise<string> {
  const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !blob) throw new Error('read_failed');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const contentType =
    blob.type && blob.type !== 'application/octet-stream' ? blob.type : contentTypeFor(path);
  const fileName = path.split('/').pop() || 'image.jpg';

  const initRes = await fetch(`${API_BASE}/s2s/v2.1/file/hair-transfer`, {
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

    // 1) Push the image(s) to Perfect Corp's File API and get file ids.
    let srcFileId: string;
    let refFileId: string | null = null;
    try {
      srcFileId = await uploadToProvider(admin, selfiePath);
      if (source === 'reference') refFileId = await uploadToProvider(admin, refPath!);
    } catch (e) {
      console.error('provider upload error:', e);
      return await fail('Could not upload your photo to the styler. Please try another photo.');
    }

    // 2) Create the task.
    const taskBody = source === 'template'
      ? { src_file_id: srcFileId, template_id: templateId }
      : { src_file_id: srcFileId, ref_file_id: refFileId };
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

    // 3) Poll for the result.
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
