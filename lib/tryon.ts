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
  const path = `${userId}/inputs/${Date.now()}-${kind}.jpg`;
  const { body, contentType } = await readImageBody(resizedUri, 'image/jpeg');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: contentType || 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

/** Resolve a try-on storage path to a short-lived signed URL for display. */
export async function signTryonPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
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
