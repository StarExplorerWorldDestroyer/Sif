import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Haircut } from '@/types';

const BUCKET = 'haircut-photos';

/** True if a haircut has at least one usable photo. */
export function hasPhoto(haircut: Haircut): boolean {
  return haircut.photos.length > 0 && !!haircut.photos[0]?.uri;
}

/** The image shown as a haircut's thumbnail / hero, or '' if none. */
export function primaryPhotoUri(haircut: Haircut): string {
  return haircut.photos[0]?.uri ?? '';
}

/** True if a URI already points at remote storage (no upload needed). */
export function isRemote(uri: string): boolean {
  return uri.startsWith('http');
}

/**
 * Read a locally-picked image into something Supabase Storage can upload.
 * - Web: ImagePicker returns a blob:/data: URL, which FileSystem can't read,
 *   so we fetch it into a Blob and upload that.
 * - Native: read the file as base64 and decode to an ArrayBuffer.
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
 * Upload a local photo file to Supabase Storage and return its public URL.
 * Files are namespaced by user + haircut so the security rules can enforce
 * that you only write to your own folder.
 */
export async function uploadPhoto(
  userId: string,
  haircutId: string,
  photoId: string,
  localUri: string,
): Promise<string> {
  const ext = (localUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
  const path = `${userId}/${haircutId}/${photoId}.${ext}`;
  const { body, contentType } = await readImageBody(
    localUri,
    ext === 'png' ? 'image/png' : 'image/jpeg',
  );

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Upload a photo attached to a direct message and return its public URL. */
export async function uploadMessagePhoto(
  userId: string,
  conversationId: string,
  localUri: string,
): Promise<string> {
  const ext = (localUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userId}/${conversationId}/${fileId}.${ext}`;
  const { body, contentType } = await readImageBody(
    localUri,
    ext === 'png' ? 'image/png' : 'image/jpeg',
  );

  const { error } = await supabase.storage
    .from('message-photos')
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  return supabase.storage.from('message-photos').getPublicUrl(path).data.publicUrl;
}

/** Upload a profile avatar and return its public URL (cache-busted). */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = (localUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const { body, contentType } = await readImageBody(
    localUri,
    ext === 'png' ? 'image/png' : 'image/jpeg',
  );

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  // Append a timestamp so the new image isn't served from cache.
  return `${url}?v=${Date.now()}`;
}
