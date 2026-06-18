import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { uploadAvatar } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import type { CutReminder, Privacy, Profile, Units } from '@/types';

export type ProfilePatch = Partial<{
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string;
  instagram: string;
  website: string;
  currency: string;
  units: Units;
  privacy: Privacy;
  isStylist: boolean;
  notificationsEnabled: boolean;
  cutReminder: CutReminder | null;
}>;

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (patch: ProfilePatch) => Promise<{ error: string | null }>;
  uploadAndSetAvatar: (localUri: string) => Promise<{ error: string | null }>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function rowToProfile(row: any): Profile {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    instagram: row.instagram ?? '',
    website: row.website ?? '',
    currency: row.currency ?? 'USD',
    units: (row.units as Units) ?? 'in',
    profilePublic: row.profile_public ?? false,
    privacy: (row.privacy as Privacy) ?? (row.profile_public ? 'public' : 'private'),
    isStylist: row.is_stylist ?? false,
    notificationsEnabled: row.notifications_enabled ?? true,
    cutReminder: (row.cut_reminder as CutReminder | null) ?? null,
  };
}

function patchToRow(patch: ProfilePatch) {
  const row: Record<string, unknown> = {};
  if (patch.username !== undefined) row.username = patch.username || null;
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.instagram !== undefined) row.instagram = patch.instagram || null;
  if (patch.website !== undefined) row.website = patch.website || null;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (patch.units !== undefined) row.units = patch.units;
  if (patch.privacy !== undefined) {
    row.privacy = patch.privacy;
    // Keep the legacy boolean in sync so older public-page logic still works.
    row.profile_public = patch.privacy === 'public';
  }
  if (patch.isStylist !== undefined) row.is_stylist = patch.isStylist;
  if (patch.notificationsEnabled !== undefined)
    row.notifications_enabled = patch.notificationsEnabled;
  if (patch.cutReminder !== undefined) row.cut_reminder = patch.cutReminder;
  return row;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setProfile(rowToProfile(data));
    } else {
      // First login: create a default profile row.
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id })
        .select()
        .single();
      if (created) setProfile(rowToProfile(created));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function updateProfile(patch: ProfilePatch) {
    if (!user) return { error: 'Not signed in' };
    const { data, error } = await supabase
      .from('profiles')
      .update(patchToRow(patch))
      .eq('id', user.id)
      .select()
      .single();
    if (error) return { error: error.message };
    if (data) setProfile(rowToProfile(data));
    return { error: null };
  }

  async function uploadAndSetAvatar(localUri: string) {
    if (!user) return { error: 'Not signed in' };
    try {
      const url = await uploadAvatar(user.id, localUri);
      return await updateProfile({ avatarUrl: url });
    } catch (e: any) {
      return { error: e?.message ?? 'Upload failed' };
    }
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, uploadAndSetAvatar }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside a ProfileProvider');
  return ctx;
}
