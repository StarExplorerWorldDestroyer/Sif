import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const BUCKET = 'reference-photos';
const SIGNED_TTL = 60 * 60; // 1 hour
const MAX_LONG_SIDE = 1600;

export type InspirationKind = 'photo' | 'pin' | 'board';

export type Inspiration = {
  id: string;
  kind: InspirationKind;
  title: string;
  note: string;
  storagePath: string | null;
  sourceUrl: string | null;
  url: string | null;
  /** Public Pinterest oEmbed thumbnail (pin/board rows). */
  previewUrl: string | null;
  styleSlug: string | null;
  createdAt: string;
  /** Signed display URL for photo rows. */
  imageUrl?: string;
};

export type PinterestLinkKind = 'pin' | 'board' | 'other';

type PinterestMeta = {
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
};

/** Normalize a pasted URL to an absolute https URL string. */
export function normalizeHttpsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Follow redirects (e.g. pin.it → www.pinterest.com/pin/…) so we store and
 * open a real Pinterest page URL. Falls back to the input on failure.
 */
export async function resolveCanonicalUrl(raw: string): Promise<string> {
  const start = normalizeHttpsUrl(raw);
  try {
    new URL(start);
  } catch {
    return start;
  }
  try {
    const res = await fetch(start, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'text/html,application/json' },
    });
    // Prefer the final response URL after redirects.
    if (res.url && /^https?:\/\//i.test(res.url)) {
      // Strip noisy invite/share query junk when present.
      try {
        const u = new URL(res.url);
        if (u.hostname.includes('pinterest.')) {
          u.search = '';
          u.hash = '';
          return u.toString();
        }
        return res.url;
      } catch {
        return res.url;
      }
    }
  } catch {
    // ignore — keep original
  }
  return start;
}

/** Classify a pasted URL as a Pinterest pin, board, or other Pinterest page. */
export function classifyPinterestUrl(raw: string): {
  kind: PinterestLinkKind | null;
  url: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: null, url: trimmed };
  let parsed: URL;
  try {
    parsed = new URL(normalizeHttpsUrl(trimmed));
  } catch {
    return { kind: null, url: trimmed };
  }
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isPinIt = host === 'pin.it';
  const isPinterest = isPinIt || host === 'pinterest.com' || host.endsWith('.pinterest.com');
  if (!isPinterest) return { kind: null, url: parsed.toString() };

  const path = parsed.pathname.replace(/\/+$/, '');
  if (isPinIt || /\/pin\//i.test(path)) {
    return { kind: 'pin', url: parsed.toString() };
  }
  // /username/board-name  (two segments, not reserved paths)
  const parts = path.split('/').filter(Boolean);
  const reserved = new Set(['pin', 'search', 'ideas', 'today', 'settings', 'login', '_']);
  if (parts.length >= 2 && !reserved.has(parts[0].toLowerCase())) {
    return { kind: 'board', url: parsed.toString() };
  }
  return { kind: 'other', url: parsed.toString() };
}

/**
 * Fetch title + thumbnail via Pinterest oEmbed.
 * Tries a direct call first (works on native); falls back to our edge function
 * when the browser blocks CORS.
 */
export async function fetchPinterestMeta(rawUrl: string): Promise<PinterestMeta> {
  const resolved = await resolveCanonicalUrl(rawUrl);
  const classified = classifyPinterestUrl(resolved);
  const target = classified.url || resolved;

  const viaEdge = async (): Promise<PinterestMeta> => {
    try {
      const { data, error } = await supabase.functions.invoke('pinterest-preview', {
        body: { url: target },
      });
      if (error || !data) return { url: target, title: null, thumbnailUrl: null };
      return {
        url: typeof data.url === 'string' ? data.url : target,
        title: typeof data.title === 'string' ? data.title : null,
        thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
      };
    } catch {
      return { url: target, title: null, thumbnailUrl: null };
    }
  };

  if (Platform.OS === 'web') {
    // Browsers can't call pinterest.com/oembed.json (no CORS).
    return viaEdge();
  }

  try {
    const endpoint = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(target)}`;
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return viaEdge();
    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
    };
    return {
      url: target,
      title: data.title?.trim() || null,
      thumbnailUrl: data.thumbnail_url?.trim() || null,
    };
  } catch {
    return viaEdge();
  }
}

/**
 * Open a saved pin/board in the browser (or Pinterest via universal links).
 * Always uses https — the old pinterest:// scheme opened blank tabs, especially
 * for pin.it short links.
 */
export async function openInspirationLink(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;
  const openable = await resolveCanonicalUrl(trimmed);
  const href = normalizeHttpsUrl(openable);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(href);
}

async function downscaleToJpeg(uri: string, width?: number, height?: number): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    const longSide = Math.max(width ?? 0, height ?? 0);
    if (width && height && longSide > MAX_LONG_SIDE) {
      const scale = MAX_LONG_SIDE / longSide;
      ctx.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
    }
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    return out.uri;
  } catch {
    return uri;
  }
}

async function readImageBody(
  localUri: string,
): Promise<{ body: Blob | ArrayBuffer; contentType: string }> {
  if (Platform.OS === 'web') {
    const res = await fetch(localUri);
    const blob = await res.blob();
    return { body: blob, contentType: blob.type || 'image/jpeg' };
  }
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  return { body: decode(base64), contentType: 'image/jpeg' };
}

function rowToInspiration(row: any, imageUrl?: string): Inspiration {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ?? '',
    note: row.note ?? '',
    storagePath: row.storage_path ?? null,
    sourceUrl: row.source_url ?? null,
    url: row.url ?? null,
    previewUrl: row.preview_url ?? null,
    styleSlug: row.style_slug ?? null,
    createdAt: row.created_at,
    imageUrl,
  };
}

/** Backfill oEmbed preview/title for a link row that was saved without one. */
async function enrichLinkPreview(row: any): Promise<any> {
  if (row.kind === 'photo' || row.preview_url || !row.url) return row;
  const meta = await fetchPinterestMeta(row.url);
  if (!meta.thumbnailUrl && !meta.title) {
    // Still upgrade short links to the canonical URL when we can.
    if (meta.url && meta.url !== row.url) {
      await supabase
        .from('inspirations')
        .update({ url: meta.url, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      return { ...row, url: meta.url };
    }
    return row;
  }
  const patch = {
    url: meta.url || row.url,
    preview_url: meta.thumbnailUrl,
    title:
      row.title && row.title !== 'Pinterest pin' && row.title !== 'Pinterest board'
        ? row.title
        : meta.title || row.title,
    updated_at: new Date().toISOString(),
  };
  await supabase.from('inspirations').update(patch).eq('id', row.id);
  return { ...row, ...patch };
}

/** List the user's inspirations (newest first), with signed URLs for photos. */
export async function listInspirations(userId: string): Promise<Inspiration[]> {
  const { data, error } = await supabase
    .from('inspirations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];

  // Best-effort: fill in missing pin previews (also upgrades pin.it → full URLs).
  // Cap concurrent backfills so a large library doesn't stall the screen.
  let pending = 0;
  const enriched = await Promise.all(
    data.map(async (r: any) => {
      if ((r.kind === 'pin' || r.kind === 'board') && !r.preview_url && pending < 8) {
        pending += 1;
        try {
          return await enrichLinkPreview(r);
        } catch {
          return r;
        }
      }
      return r;
    }),
  );

  const photoPaths = enriched
    .filter((r: any) => r.kind === 'photo' && r.storage_path)
    .map((r: any) => r.storage_path as string);
  const urlByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(photoPaths, SIGNED_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }
  return enriched.map((r: any) =>
    rowToInspiration(r, r.storage_path ? urlByPath.get(r.storage_path) : undefined),
  );
}

/** Upload a local image and create a photo inspiration row. */
export async function addInspirationPhoto(
  userId: string,
  localUri: string,
  opts?: {
    title?: string;
    note?: string;
    sourceUrl?: string;
    styleSlug?: string;
    width?: number;
    height?: number;
  },
): Promise<Inspiration> {
  const jpegUri = await downscaleToJpeg(localUri, opts?.width, opts?.height);
  const path = `${userId}/${Date.now()}-ref.jpg`;
  const { body, contentType } = await readImageBody(jpegUri);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: contentType || 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('inspirations')
    .insert({
      user_id: userId,
      kind: 'photo',
      title: opts?.title?.trim() ?? '',
      note: opts?.note?.trim() ?? '',
      storage_path: path,
      source_url: opts?.sourceUrl?.trim() || null,
      style_slug: opts?.styleSlug ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to save photo');

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return rowToInspiration(data, signed?.signedUrl);
}

/** Save a Pinterest (or other) link as a pin/board inspiration. */
export async function addInspirationLink(
  userId: string,
  rawUrl: string,
  opts?: { title?: string; note?: string; styleSlug?: string },
): Promise<Inspiration> {
  const meta = await fetchPinterestMeta(rawUrl);
  const classified = classifyPinterestUrl(meta.url || rawUrl);
  const url = meta.url || classified.url || normalizeHttpsUrl(rawUrl);

  try {
    new URL(url);
  } catch {
    throw new Error('That doesn’t look like a valid link.');
  }

  const kind: InspirationKind = classified.kind === 'board' ? 'board' : 'pin';
  const defaultTitle =
    kind === 'board'
      ? 'Pinterest board'
      : classified.kind
        ? 'Pinterest pin'
        : 'Saved link';

  const { data, error } = await supabase
    .from('inspirations')
    .insert({
      user_id: userId,
      kind,
      title: opts?.title?.trim() || meta.title || defaultTitle,
      note: opts?.note?.trim() ?? '',
      url,
      preview_url: meta.thumbnailUrl,
      style_slug: opts?.styleSlug ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to save link');
  return rowToInspiration(data);
}

/** Delete an inspiration and, for photos, its storage object. */
export async function deleteInspiration(item: Inspiration): Promise<boolean> {
  if (item.kind === 'photo' && item.storagePath) {
    await supabase.storage.from(BUCKET).remove([item.storagePath]);
  }
  const { error } = await supabase.from('inspirations').delete().eq('id', item.id);
  return !error;
}

/** Update title/note on an inspiration. */
export async function updateInspiration(
  id: string,
  patch: { title?: string; note?: string },
): Promise<boolean> {
  const { error } = await supabase
    .from('inspirations')
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.note !== undefined ? { note: patch.note.trim() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  return !error;
}

/**
 * Download a remote (signed) image to a local cache file for Share / save.
 */
export async function cacheInspirationImage(url: string): Promise<string> {
  if (!/^https?:\/\//.test(url)) return url;
  if (Platform.OS === 'web') return url;
  const dest = `${FileSystem.cacheDirectory}inspiration-${Date.now()}.jpg`;
  const { uri } = await FileSystem.downloadAsync(url, dest);
  return uri;
}
