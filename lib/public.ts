import { supabase } from '@/lib/supabase';
import type { Privacy, PublicPost, PublicProfile, UserSearchResult } from '@/types';

function rowToPublicProfile(row: any): PublicProfile {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    privacy: (row.privacy as Privacy) ?? undefined,
    isStylist: row.is_stylist ?? undefined,
  };
}

function rpcToCard(row: any): UserSearchResult {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    avatarUrl: row.avatar_url ?? '',
    privacy: (row.privacy as Privacy) ?? 'public',
    isStylist: row.is_stylist ?? false,
  };
}

/** Search users by username / display name (privacy-safe minimal fields). */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data } = await supabase.rpc('search_profiles', { q });
  return (data ?? []).map(rpcToCard);
}

/** A minimal card for a username, even if the profile is private. */
export async function fetchProfileCard(username: string): Promise<UserSearchResult | null> {
  const { data } = await supabase.rpc('profile_card', { p_username: username });
  const row = Array.isArray(data) ? data[0] : data;
  return row ? rpcToCard(row) : null;
}

/**
 * Resolve a profile for viewing by username.
 * - `full` is set when the viewer is allowed to see details (RLS-permitted).
 * - `card` is the minimal, always-available identity (or null if no such user).
 * When `card` exists but `full` is null, the profile is private/connections-only
 * and the viewer isn't allowed in yet.
 */
export async function fetchProfileView(
  username: string,
): Promise<{ card: UserSearchResult | null; full: PublicProfile | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, privacy, is_stylist')
    .eq('username', username)
    .maybeSingle();
  if (data) {
    return { card: rpcToCard(data), full: rowToPublicProfile(data) };
  }
  const card = await fetchProfileCard(username);
  return { card, full: null };
}

/** Attach author profiles to a set of post rows in a single extra query. */
async function withAuthors(postRows: any[]): Promise<PublicPost[]> {
  if (postRows.length === 0) return [];
  const userIds = Array.from(new Set(postRows.map((p) => p.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .in('id', userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, rowToPublicProfile(p)]));

  return postRows
    .filter((p) => byId.has(p.user_id))
    .map((p) => ({
      id: p.id,
      caption: p.caption ?? '',
      photoUrl: p.photo_url ?? '',
      cutType: p.cut_type ?? '',
      createdAt: p.created_at,
      author: byId.get(p.user_id)!,
    }));
}

/** A public profile by username (only returns viewable profiles via RLS). */
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, privacy, is_stylist')
    .eq('username', username)
    .maybeSingle();
  return data ? rowToPublicProfile(data) : null;
}

/** All public posts for a given user id, newest first. */
export async function fetchPostsForUser(userId: string): Promise<PublicPost[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return withAuthors(data ?? []);
}

/** A single public post by id, with its author. */
export async function fetchPublicPost(id: string): Promise<PublicPost | null> {
  const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const [withAuthor] = await withAuthors([data]);
  return withAuthor ?? null;
}

/** Recent public posts across everyone (the Explore feed). */
export async function fetchPublicFeed(limit = 50): Promise<PublicPost[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return withAuthors(data ?? []);
}
