import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const BUCKET = 'tryon-photos';
const SIGNED_TTL = 60 * 60; // 1 hour

/** A predefined hairstyle the user can try on. */
export type TryOnStyle = {
  templateId: string;
  label: string;
  thumbnailUrl: string;
};

/** Outcome of a try-on request. */
export type TryOnResult = {
  id: string | null;
  status: 'succeeded' | 'failed';
  resultUrl?: string;
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
 * its storage path. The Edge Function signs these paths so Perfect Corp can
 * fetch them; they're never publicly readable.
 */
export async function uploadTryonImage(
  userId: string,
  kind: 'selfie' | 'ref',
  localUri: string,
): Promise<string> {
  const ext = (localUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
  const path = `${userId}/inputs/${Date.now()}-${kind}.${ext}`;
  const { body, contentType } = await readImageBody(
    localUri,
    ext === 'png' ? 'image/png' : 'image/jpeg',
  );
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
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

function mapStyles(data: any): TryOnStyle[] {
  const list: any[] = Array.isArray(data)
    ? data
    : data?.templates ?? data?.results ?? data?.list ?? data?.items ?? [];
  return list
    .map((item: any) => ({
      templateId: String(item?.template_id ?? item?.id ?? ''),
      label: String(item?.name ?? item?.title ?? item?.label ?? ''),
      thumbnailUrl: String(
        item?.thumbnail_url ?? item?.thumbnail ?? item?.preview_url ?? item?.url ?? '',
      ),
    }))
    .filter((s) => s.templateId);
}

/** Fetch the predefined hairstyle library from the provider. */
export async function fetchTryOnStyles(): Promise<TryOnStyle[]> {
  const { data, error } = await supabase.functions.invoke('hairstyle-tryon', {
    body: { action: 'styles' },
  });
  if (error) return [];
  return mapStyles(data?.data);
}

type TryOnRequest =
  | { selfiePath: string; source: 'template'; templateId: string; styleLabel?: string }
  | { selfiePath: string; source: 'reference'; refPath: string; styleLabel?: string };

/** Run a try-on and resolve a signed URL for the generated image. */
export async function requestTryOn(req: TryOnRequest): Promise<TryOnResult> {
  const { data, error } = await supabase.functions.invoke('hairstyle-tryon', {
    body: { action: 'create', ...req },
  });
  if (error || !data) {
    return { id: null, status: 'failed', error: 'Something went wrong. Please try again.' };
  }
  if (data.status === 'succeeded' && data.resultPath) {
    const resultUrl = await signTryonPhoto(data.resultPath);
    return { id: data.id, status: 'succeeded', resultUrl: resultUrl ?? undefined };
  }
  return { id: data.id ?? null, status: 'failed', error: data.error ?? 'Could not generate this look.' };
}
