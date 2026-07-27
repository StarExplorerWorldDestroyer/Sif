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
  styleSlug: string | null;
  createdAt: string;
  /** Signed display URL for photo rows. */
  imageUrl?: string;
};

export type PinterestLinkKind = 'pin' | 'board' | 'other';

/** Classify a pasted URL as a Pinterest pin, board, or other Pinterest page. */
export function classifyPinterestUrl(raw: string): {
  kind: PinterestLinkKind | null;
  url: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: null, url: trimmed };
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
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

/** Open a pin/board URL in the Pinterest app if possible, else the browser. */
export async function openInspirationLink(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;
  // iOS/Android: try the pinterest:// scheme first for a better handoff.
  try {
    const web = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const path = web.pathname + web.search;
    const appUrl = `pinterest://www.pinterest.com${path}`;
    const can = await Linking.canOpenURL(appUrl);
    if (can) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch {
    // fall through to https
  }
  await Linking.openURL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
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
    styleSlug: row.style_slug ?? null,
    createdAt: row.created_at,
    imageUrl,
  };
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

  const photoPaths = data
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
  return data.map((r: any) =>
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
  const { kind, url } = classifyPinterestUrl(rawUrl);
  if (!kind || kind === 'other') {
    // Allow non-Pinterest https links as pins (generic inspiration link).
    let normalized = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      new URL(normalized);
    } catch {
      throw new Error('That doesn’t look like a valid link.');
    }
    const { data, error } = await supabase
      .from('inspirations')
      .insert({
        user_id: userId,
        kind: 'pin',
        title: opts?.title?.trim() || 'Saved link',
        note: opts?.note?.trim() ?? '',
        url: normalized,
        style_slug: opts?.styleSlug ?? null,
      })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('Failed to save link');
    return rowToInspiration(data);
  }

  const { data, error } = await supabase
    .from('inspirations')
    .insert({
      user_id: userId,
      kind,
      title:
        opts?.title?.trim() ||
        (kind === 'board' ? 'Pinterest board' : 'Pinterest pin'),
      note: opts?.note?.trim() ?? '',
      url,
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
