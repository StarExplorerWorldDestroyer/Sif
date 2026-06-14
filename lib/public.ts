import { supabase } from '@/lib/supabase';
import type { PublicPost, PublicProfile } from '@/types';

function rowToPublicProfile(row: any): PublicProfile {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
  };
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

/** A public profile by username (only returns public profiles via RLS). */
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
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
