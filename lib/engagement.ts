import { fetchCardsByIds } from '@/lib/public';
import { supabase } from '@/lib/supabase';
import type { PostComment, UserSearchResult } from '@/types';

/** Like or unlike a post as the current user. */
export async function setPostLike(postId: string, like: boolean): Promise<void> {
  if (like) {
    await supabase
      .from('post_likes')
      .upsert({ post_id: postId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true });
  } else {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return;
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
  }
}

/** All comments on a post (oldest first), with authors resolved for display. */
export async function fetchComments(postId: string): Promise<PostComment[]> {
  const { data } = await supabase
    .from('post_comments')
    .select('id, post_id, user_id, body, created_at, parent_id')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const cards = await fetchCardsByIds(rows.map((r) => r.user_id));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const fallback = (id: string): UserSearchResult => ({
    id,
    username: null,
    displayName: 'Sif user',
    avatarUrl: '',
    privacy: 'public',
    isStylist: false,
  });

  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    body: r.body ?? '',
    createdAt: r.created_at,
    author: byId.get(r.user_id) ?? fallback(r.user_id),
    parentId: r.parent_id ?? null,
  }));
}

/**
 * Add a comment (or a reply when `parentId` is set) to a post.
 * Returns the new comment id or null on failure.
 */
export async function addComment(
  postId: string,
  body: string,
  parentId: string | null = null,
): Promise<string | null> {
  const text = body.trim();
  if (!text) return null;
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, body: text, parent_id: parentId })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

/** Edit the body of your own comment. */
export async function editComment(id: string, body: string): Promise<boolean> {
  const text = body.trim();
  if (!text) return false;
  const { error } = await supabase.from('post_comments').update({ body: text }).eq('id', id);
  return !error;
}

export async function deleteComment(id: string): Promise<void> {
  await supabase.from('post_comments').delete().eq('id', id);
}

/** The people who liked a post (most recent first), as display cards. */
export async function fetchLikers(postId: string): Promise<UserSearchResult[]> {
  const { data } = await supabase
    .from('post_likes')
    .select('user_id, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const cards = await fetchCardsByIds(rows.map((r) => r.user_id));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return rows.map((r) => byId.get(r.user_id)).filter((c): c is UserSearchResult => Boolean(c));
}

export type EngagementCount = { likeCount: number; commentCount: number };

/** Like/comment counts for a set of post ids (for profile grids). */
export async function fetchEngagementCounts(
  postIds: string[],
): Promise<Record<string, EngagementCount>> {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  const out: Record<string, EngagementCount> = {};
  if (ids.length === 0) return out;
  for (const id of ids) out[id] = { likeCount: 0, commentCount: 0 };

  const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase.from('post_likes').select('post_id').in('post_id', ids),
    supabase.from('post_comments').select('post_id').in('post_id', ids),
  ]);
  for (const r of likeRows ?? []) {
    if (out[r.post_id]) out[r.post_id].likeCount += 1;
  }
  for (const r of commentRows ?? []) {
    if (out[r.post_id]) out[r.post_id].commentCount += 1;
  }
  return out;
}
