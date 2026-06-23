import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const BUCKET = 'tryon-photos';
const SIGNED_TTL = 60 * 60; // 1 hour

// The provider's effects cap input dimensions (bangs/wavy/length/volume at
// 1024px on the long side, color at 1920px). A raw phone selfie is far larger,
// which makes every effect except the lenient hairstyle one fail. Downscaling
// to a safe long-side and re-encoding as JPEG keeps all effects happy (and
// uploads smaller/faster). Hairstyle quality is unaffected at this size.
const MAX_LONG_SIDE = 1024;

/** Downscale (if needed) and re-encode an image to JPEG before upload. */
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
    return uri; // fall back to the original if manipulation isn't available
  }
}

/** Hair effects backed by the YouCam API. */
export type EffectKind = 'hairstyle' | 'color' | 'bangs' | 'extension' | 'volume' | 'wavy';

/** Whether an effect picks from a template library or takes color settings. */
export type EffectType = 'template' | 'color';

export const EFFECTS: { id: EffectKind; label: string; type: EffectType }[] = [
  { id: 'hairstyle', label: 'Style', type: 'template' },
  { id: 'color', label: 'Color', type: 'color' },
  { id: 'bangs', label: 'Bangs', type: 'template' },
  { id: 'extension', label: 'Length', type: 'template' },
  { id: 'volume', label: 'Volume', type: 'template' },
  { id: 'wavy', label: 'Wavy', type: 'template' },
];

/** A template the user can apply (a hairstyle, bang shape, etc.). */
export type TryOnStyle = {
  templateId: string;
  label: string;
  thumbnailUrl: string;
};

/** Hair-color settings. A preset takes priority over a custom HEX. */
export type ColorParams = {
  hex?: string;
  preset?: string;
  intensity?: number; // 0..100
  shine?: number; // 0..100
  pattern?: 'full' | 'ombre';
  coloringSection?: 'top' | 'bottom';
};

/** Outcome of a try-on request. */
export type TryOnResult = {
  id: string | null;
  status: 'succeeded' | 'failed';
  resultUrl?: string;
  /** Storage path of the result — feed this as the selfie of the next step to chain effects. */
  resultPath?: string;
  error?: string;
};

/**
 * Read a locally-picked image into something Supabase Storage can upload.
 * Web hands us a blob:/data: URL (fetch into a Blob); native gives a file URI
 * we read as base64. Mirrors the helper in lib/photos.ts.
 */
async function readImageBody(
  localUri: string,
  fallbackContentType: string,
): Promise<{ body: Blob | ArrayBuffer; contentType: string }> {
  if (Platform.OS === 'web') {
    const res = await fetch(localUri);
    const blob = await res.blob();
    return { body: blob, contentType: blob.type || fallbackContentType };
  }
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  return { body: decode(base64), contentType: fallbackContentType };
}

/**
 * Upload a selfie or reference photo to the private try-on bucket and return
 * its storage path. The Edge Function reads these and forwards the bytes to
 * the provider; they're never publicly readable.
 */
export async function uploadTryonImage(
  userId: string,
  kind: 'selfie' | 'ref',
  localUri: string,
  dims?: { width?: number; height?: number },
): Promise<string> {
  const resizedUri = await downscaleToJpeg(localUri, dims?.width, dims?.height);
  // Selfies live under a stable folder so they can be listed and reused later;
  // references are throwaway per-request.
  const folder = kind === 'selfie' ? 'selfies' : 'refs';
  const path = `${userId}/${folder}/${Date.now()}-${kind}.jpg`;
  const { body, contentType } = await readImageBody(resizedUri, 'image/jpeg');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: contentType || 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Make a remote (or already-local) image safe for ImageManipulator + upload.
 * On web we fetch into a same-origin blob URL (avoids canvas tainting); on
 * native we download to the cache directory. Local URIs pass through.
 */
async function localizeForManipulation(uri: string): Promise<string> {
  if (!/^https?:\/\//.test(uri)) return uri;
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  const dest = `${FileSystem.cacheDirectory}tryon-import-${Date.now()}.jpg`;
  const { uri: local } = await FileSystem.downloadAsync(uri, dest);
  return local;
}

/** Upload an image from any URI (including a remote/public URL, e.g. an
 * existing haircut photo) into the private try-on bucket. */
export async function uploadTryonImageFromUri(
  userId: string,
  kind: 'selfie' | 'ref',
  sourceUri: string,
  dims?: { width?: number; height?: number },
): Promise<string> {
  const local = await localizeForManipulation(sourceUri);
  return uploadTryonImage(userId, kind, local, dims);
}

/** Resolve a try-on storage path to a short-lived signed URL for display. */
export async function signTryonPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

/** A reusable selfie the user has already added to the try-on bucket. */
export type SavedSelfie = { path: string; url: string };

/** List the user's saved selfies (most recent first) with signed display URLs. */
export async function listTryonSelfies(userId: string): Promise<SavedSelfie[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`${userId}/selfies`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error || !data) return [];
  const paths = data.filter((f) => f.name && !f.name.startsWith('.')).map((f) => `${userId}/selfies/${f.name}`);
  if (paths.length === 0) return [];
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  return (signed ?? [])
    .map((s) => ({ path: s.path ?? '', url: s.signedUrl ?? '' }))
    .filter((s) => s.path && s.url);
}

/** A previously generated look shown in the gallery. */
export type TryOnGalleryItem = {
  id: string;
  kind: EffectKind;
  styleLabel: string;
  createdAt: string;
  resultPath: string;
  url: string;
};

/** List the user's successfully generated looks (most recent first). */
export async function listTryonResults(userId: string): Promise<TryOnGalleryItem[]> {
  const { data, error } = await supabase
    .from('hairstyle_tryons')
    .select('id, kind, style_label, created_at, result_path')
    .eq('user_id', userId)
    .eq('status', 'succeeded')
    .not('result_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const rows = data.filter((r: any) => !!r.result_path);
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r: any) => r.result_path as string), SIGNED_TTL);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl ?? '']));
  return rows
    .map((r: any) => ({
      id: r.id as string,
      kind: (r.kind ?? 'hairstyle') as EffectKind,
      styleLabel: (r.style_label ?? '') as string,
      createdAt: r.created_at as string,
      resultPath: r.result_path as string,
      url: urlByPath.get(r.result_path) ?? '',
    }))
    .filter((r) => r.url);
}

/** Delete a generated look: removes the row and its stored result image. */
export async function deleteTryon(id: string, resultPath?: string | null): Promise<boolean> {
  if (resultPath) {
    await supabase.storage.from(BUCKET).remove([resultPath]);
  }
  const { error } = await supabase.from('hairstyle_tryons').delete().eq('id', id);
  return !error;
}

/** Whether the user has consented to face-photo processing for try-on. */
export async function hasTryonConsent(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('tryon_consent_at')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.tryon_consent_at;
}

/** Record the user's explicit consent to process a photo of their face. */
export async function grantTryonConsent(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ tryon_consent_at: new Date().toISOString() })
    .eq('id', userId);
  return !error;
}

/** First http(s) value on an object — finds a thumbnail regardless of which
 * field name the provider uses (prefers image-looking URLs). */
function firstUrl(item: any): string {
  const vals = Object.values(item ?? {}).filter(
    (v): v is string => typeof v === 'string' && /^https?:\/\//.test(v),
  );
  return vals.find((v) => /\.(jpe?g|png|webp)(\?|$)/i.test(v)) ?? vals[0] ?? '';
}

function mapStyles(data: any): TryOnStyle[] {
  const list: any[] = Array.isArray(data)
    ? data
    : data?.templates ?? data?.results ?? data?.list ?? data?.items ?? data?.result ?? [];
  return list
    .map((item: any) => ({
      templateId: String(item?.template_id ?? item?.id ?? item?.templateId ?? ''),
      label: String(item?.name ?? item?.title ?? item?.label ?? ''),
      thumbnailUrl: firstUrl(item),
    }))
    .filter((s) => s.templateId);
}

/** Fetch a page of the template library for a template-based effect. */
export async function fetchTryOnStyles(
  kind: EffectKind,
  startingToken?: string,
): Promise<{ styles: TryOnStyle[]; nextToken: string | null }> {
  const { data, error } = await supabase.functions.invoke('hairstyle-tryon', {
    body: { action: 'styles', kind, startingToken },
  });
  if (error) return { styles: [], nextToken: null };
  return { styles: mapStyles(data?.data), nextToken: data?.nextToken ?? null };
}

type TryOnRequest =
  | { kind: 'hairstyle'; selfiePath: string; source: 'template'; templateId: string; styleLabel?: string }
  | { kind: 'hairstyle'; selfiePath: string; source: 'reference'; refPath: string; styleLabel?: string }
  | { kind: 'bangs' | 'extension' | 'volume' | 'wavy'; selfiePath: string; templateId: string; styleLabel?: string }
  | { kind: 'color'; selfiePath: string; color: ColorParams; styleLabel?: string };

/** Run a try-on for any effect and resolve a signed URL for the result. */
export async function requestTryOn(req: TryOnRequest): Promise<TryOnResult> {
  const { data, error } = await supabase.functions.invoke('hairstyle-tryon', {
    body: { action: 'create', ...req },
  });
  if (error || !data) {
    return { id: null, status: 'failed', error: 'Something went wrong. Please try again.' };
  }
  if (data.status === 'succeeded' && data.resultPath) {
    const resultUrl = await signTryonPhoto(data.resultPath);
    return {
      id: data.id,
      status: 'succeeded',
      resultUrl: resultUrl ?? undefined,
      resultPath: data.resultPath,
    };
  }
  return { id: data.id ?? null, status: 'failed', error: data.error ?? 'Could not generate this look.' };
}
