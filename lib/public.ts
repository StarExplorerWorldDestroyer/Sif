import { supabase } from '@/lib/supabase';
import type { FollowCounts, Privacy, PublicPost, PublicProfile, UserSearchResult } from '@/types';

function rowToPublicProfile(row: any): PublicProfile {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    instagram: row.instagram ?? '',
    website: row.website ?? '',
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
    .select('id, username, display_name, bio, avatar_url, instagram, website, privacy, is_stylist')
    .eq('username', username)
    .maybeSingle();
  if (data) {
    return { card: rpcToCard(data), full: rowToPublicProfile(data) };
  }
  const card = await fetchProfileCard(username);
  return { card, full: null };
}

/** Minimal cards for a set of user ids (privacy-safe, works for anon viewers). */
export async function fetchCardsByIds(ids: string[]): Promise<UserSearchResult[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data } = await supabase.rpc('profile_cards_by_ids', { ids: unique });
  return (data ?? []).map(rpcToCard);
}

/** Attach author profiles, tagged stylist, and like/comment engagement. */
async function withAuthors(postRows: any[]): Promise<PublicPost[]> {
  if (postRows.length === 0) return [];
  const ids = postRows.map((p) => p.id);
  const userIds = Array.from(new Set(postRows.map((p) => p.user_id)));

  const [{ data: profiles }, { data: likeRows }, { data: commentRows }, { data: auth }] =
    await Promise.all([
      supabase.from('profiles').select('id, username, display_name, bio, avatar_url').in('id', userIds),
      supabase.from('post_likes').select('post_id, user_id').in('post_id', ids),
      supabase.from('post_comments').select('post_id').in('post_id', ids),
      supabase.auth.getUser(),
    ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id, rowToPublicProfile(p)]));
  const stylists = await fetchCardsByIds(postRows.map((p) => p.stylist_id));
  const stylistById = new Map(stylists.map((s) => [s.id, s]));

  const myId = auth?.user?.id ?? null;
  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const r of likeRows ?? []) {
    likeCounts.set(r.post_id, (likeCounts.get(r.post_id) ?? 0) + 1);
    if (myId && r.user_id === myId) likedByMe.add(r.post_id);
  }
  const commentCounts = new Map<string, number>();
  for (const r of commentRows ?? []) {
    commentCounts.set(r.post_id, (commentCounts.get(r.post_id) ?? 0) + 1);
  }

  return postRows
    .filter((p) => byId.has(p.user_id))
    .map((p) => ({
      id: p.id,
      caption: p.caption ?? '',
      photoUrl: p.photo_url ?? '',
      cutType: p.cut_type ?? '',
      createdAt: p.created_at,
      author: byId.get(p.user_id)!,
      stylist: p.stylist_id ? stylistById.get(p.stylist_id) ?? null : null,
      likeCount: likeCounts.get(p.id) ?? 0,
      commentCount: commentCounts.get(p.id) ?? 0,
      likedByMe: likedByMe.has(p.id),
    }));
}

/** A public profile by username (only returns viewable profiles via RLS). */
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, instagram, website, privacy, is_stylist')
    .eq('username', username)
    .maybeSingle();
  return data ? rowToPublicProfile(data) : null;
}

/** Follower (people following them) and following counts for a user. */
export async function fetchFollowCounts(userId: string): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
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
