import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import type { Haircut } from '@/types';

const BUCKET = 'haircut-photos';
const PLACEHOLDER = 'https://picsum.photos/seed/seaf/400/400';

/** The image shown as a haircut's thumbnail / hero. */
export function primaryPhotoUri(haircut: Haircut): string {
  return haircut.photos[0]?.uri ?? PLACEHOLDER;
}

/** True if a URI already points at remote storage (no upload needed). */
export function isRemote(uri: string): boolean {
  return uri.startsWith('http');
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
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType, upsert: true });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
