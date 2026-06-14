import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { uploadAvatar } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import type { Profile, Units } from '@/types';

export type ProfilePatch = Partial<{
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string;
  currency: string;
  units: Units;
  profilePublic: boolean;
  notificationsEnabled: boolean;
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
    currency: row.currency ?? 'USD',
    units: (row.units as Units) ?? 'in',
    profilePublic: row.profile_public ?? false,
    notificationsEnabled: row.notifications_enabled ?? true,
  };
}

function patchToRow(patch: ProfilePatch) {
  const row: Record<string, unknown> = {};
  if (patch.username !== undefined) row.username = patch.username || null;
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (patch.units !== undefined) row.units = patch.units;
  if (patch.profilePublic !== undefined) row.profile_public = patch.profilePublic;
  if (patch.notificationsEnabled !== undefined)
    row.notifications_enabled = patch.notificationsEnabled;
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
