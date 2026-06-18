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
    .select('id, post_id, user_id, body, created_at')
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
  }));
}

/** Add a comment to a post; returns the new comment id or null on failure. */
export async function addComment(postId: string, body: string): Promise<string | null> {
  const text = body.trim();
  if (!text) return null;
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, body: text })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function deleteComment(id: string): Promise<void> {
  await supabase.from('post_comments').delete().eq('id', id);
}
