import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { Haircut } from '@/types';

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}photos/`;

/** Fallback image when a haircut has no photos. */
const PLACEHOLDER = 'https://picsum.photos/seed/seaf/400/400';

/** The image shown as a haircut's thumbnail / hero. */
export function primaryPhotoUri(haircut: Haircut): string {
  return haircut.photos[0]?.uri ?? PLACEHOLDER;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/**
 * Copy a picked/captured photo into the app's permanent documents folder so it
 * survives even if the OS clears the temporary image-picker cache.
 *
 * Remote URLs and files already in our folder are returned unchanged. On web
 * (no FileSystem) the original URI is returned as-is.
 */
export async function persistPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return uri;
  if (uri.startsWith('http')) return uri;
  if (uri.startsWith(PHOTO_DIR)) return uri;

  try {
    await ensureDir();
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${PHOTO_DIR}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    // If copying fails for any reason, fall back to the original URI.
    return uri;
  }
}

/** Best-effort deletion of a photo file from permanent storage. */
export async function deletePhotoFile(uri: string): Promise<void> {
  if (Platform.OS === 'web' || !uri.startsWith(PHOTO_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
