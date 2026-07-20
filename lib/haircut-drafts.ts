import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Photo } from '@/types';

/** Fields we persist so a failed/retried save never loses typed notes. */
export type HaircutDraft = {
  cutType: string;
  location: string;
  stylistName: string;
  stylistId: string | null;
  date: string;
  price: string;
  tip: string;
  notes: string;
  photos: Photo[];
  lengthTop: string;
  lengthSides: string;
  lengthBack: string;
  techniques: string[];
  tools: string[];
  updatedAt: string;
};

function draftKey(kind: 'new' | 'edit' | 'client', id?: string): string {
  if (kind === 'edit' && id) return `haircut-draft:edit:${id}`;
  if (kind === 'client' && id) return `haircut-draft:client:${id}`;
  return 'haircut-draft:new';
}

export function haircutDraftKey(opts: {
  editingId?: string;
  clientId?: string;
}): string {
  if (opts.editingId) return draftKey('edit', opts.editingId);
  if (opts.clientId) return draftKey('client', opts.clientId);
  return draftKey('new');
}

export async function loadHaircutDraft(key: string): Promise<HaircutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HaircutDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveHaircutDraft(key: string, draft: Omit<HaircutDraft, 'updatedAt'>): Promise<void> {
  try {
    const payload: HaircutDraft = { ...draft, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Never block typing on storage failures.
  }
}

export async function clearHaircutDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** True if a draft has anything worth restoring (especially notes). */
export function draftHasContent(d: HaircutDraft | null | undefined): boolean {
  if (!d) return false;
  return (
    d.notes.trim().length > 0 ||
    d.cutType.trim().length > 0 ||
    d.photos.length > 0 ||
    d.location.trim().length > 0 ||
    d.stylistName.trim().length > 0 ||
    d.techniques.length > 0 ||
    d.tools.length > 0
  );
}
