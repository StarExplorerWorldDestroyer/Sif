import { supabase } from '@/lib/supabase';

export type ReportTargetType = 'post' | 'message' | 'user' | 'haircut';

/**
 * Block another user. Blocking is mutual: afterwards neither of you can message
 * the other, and neither sees the other's posts, profile, or search results.
 */
export async function blockUser(targetId: string): Promise<boolean> {
  const { error } = await supabase.rpc('block_user', { target: targetId });
  return !error;
}

/** Reverse a previous block. */
export async function unblockUser(targetId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unblock_user', { target: targetId });
  return !error;
}

/** File a content/abuse report for review. */
export async function reportContent(args: {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string | null;
  reason?: string;
}): Promise<boolean> {
  const { error } = await supabase.rpc('report_content', {
    p_target_type: args.targetType,
    p_target_id: args.targetId,
    p_target_user: args.targetUserId ?? null,
    p_reason: args.reason ?? '',
  });
  return !error;
}

/** Ids of everyone the current user has blocked (for optimistic UI hiding). */
export async function fetchBlockedIds(): Promise<string[]> {
  const { data } = await supabase.from('blocked_users').select('blocked_id');
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export type BlockedUser = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string;
};

/** The accounts you've blocked, for the management screen. */
export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data } = await supabase.rpc('list_blocked_users');
  return (data ?? []).map((r: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name || 'Sif user',
    avatarUrl: r.avatar_url || '',
  }));
}
