// Resolve a Pinterest (or pin.it) URL to a canonical page + oEmbed thumbnail.
// Used so web clients can fetch previews without hitting browser CORS limits.
//
// POST { url: string } -> { url, title, thumbnailUrl }
//
// Deploy: supabase functions deploy pinterest-preview --use-api --project-ref jnbtzrkxowvqkdlgevrp

import { getAdmin, getUserId, json, withCors } from '../_shared/util.ts';

async function resolveCanonical(raw: string): Promise<string> {
  const start = /^https?:\/\//i.test(raw) ? raw.trim() : `https://${raw.trim()}`;
  try {
    const res = await fetch(start, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'text/html,application/json', 'User-Agent': 'GoldenSif/1.0' },
    });
    if (res.url && /^https?:\/\//i.test(res.url)) {
      try {
        const u = new URL(res.url);
        if (u.hostname.includes('pinterest.')) {
          u.search = '';
          u.hash = '';
          return u.toString();
        }
      } catch {
        // ignore
      }
      return res.url;
    }
  } catch {
    // ignore
  }
  return start;
}

Deno.serve((req) =>
  withCors(req, async () => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const admin = getAdmin();
    const userId = await getUserId(req, admin);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    let body: { url?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const raw = body.url?.trim();
    if (!raw) return json({ error: 'url required' }, 400);

    const resolved = await resolveCanonical(raw);
    try {
      const endpoint = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(resolved)}`;
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': 'GoldenSif/1.0' },
      });
      if (!res.ok) {
        return json({ url: resolved, title: null, thumbnailUrl: null });
      }
      const data = await res.json();
      return json({
        url: resolved,
        title: typeof data.title === 'string' ? data.title.trim() : null,
        thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : null,
      });
    } catch (e) {
      console.error('pinterest-preview error', e);
      return json({ url: resolved, title: null, thumbnailUrl: null });
    }
  }),
);
