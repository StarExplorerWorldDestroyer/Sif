import { fetchCardsByIds } from '@/lib/public';
import { supabase } from '@/lib/supabase';
import type { Conversation, DirectMessage, UserSearchResult } from '@/types';

const fallbackCard = (id: string): UserSearchResult => ({
  id,
  username: null,
  displayName: 'Sif user',
  avatarUrl: '',
  privacy: 'public',
  isStylist: false,
});

function rowToMessage(row: any): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body ?? '',
    imageUrl: row.image_url ?? null,
    postId: row.post_id ?? null,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
  };
}

/** Get (or lazily create) the conversation id with another user. */
export async function getOrCreateConversation(otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', { other: otherId });
  if (error) return null;
  return (data as string) ?? null;
}

/** My conversations, newest activity first, with the other party resolved. */
export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await supabase.rpc('list_conversations');
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const cards = await fetchCardsByIds(rows.map((r: any) => r.other_id));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return rows.map((r: any) => ({
    id: r.id,
    other: byId.get(r.other_id) ?? fallbackCard(r.other_id),
    lastMessage: r.last_message ?? '',
    lastMessageAt: r.last_message_at ?? null,
    lastSender: r.last_sender ?? null,
    unread: r.unread ?? 0,
  }));
}

/** Resolve the other participant of a conversation (for direct deep links). */
export async function fetchConversationOther(
  conversationId: string,
  myId: string,
): Promise<UserSearchResult | null> {
  const { data } = await supabase
    .from('conversations')
    .select('user_a, user_b')
    .eq('id', conversationId)
    .maybeSingle();
  if (!data) return null;
  const otherId = data.user_a === myId ? data.user_b : data.user_a;
  const cards = await fetchCardsByIds([otherId]);
  return cards[0] ?? fallbackCard(otherId);
}

const MSG_PHOTO_BUCKET = 'message-photos';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * Extract the storage path for a message photo. Accepts a raw path (current
 * format) or a legacy public URL (from before the bucket was made private).
 */
function messagePhotoPath(imageUrl: string): string {
  const marker = `/${MSG_PHOTO_BUCKET}/`;
  const i = imageUrl.indexOf(marker);
  return i >= 0 ? imageUrl.slice(i + marker.length).split('?')[0] : imageUrl;
}

/** Resolve a single message photo (path or legacy URL) to a signed URL. */
export async function signMessagePhoto(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  const { data } = await supabase.storage
    .from(MSG_PHOTO_BUCKET)
    .createSignedUrl(messagePhotoPath(imageUrl), SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

/** Replace each message's imageUrl with a short-lived signed URL, in place. */
async function signMessagePhotos(msgs: DirectMessage[]): Promise<void> {
  const withImg = msgs.filter((m) => m.imageUrl);
  if (withImg.length === 0) return;
  const { data } = await supabase.storage
    .from(MSG_PHOTO_BUCKET)
    .createSignedUrls(withImg.map((m) => messagePhotoPath(m.imageUrl!)), SIGNED_URL_TTL);
  if (!data) return;
  withImg.forEach((m, i) => {
    const signed = data[i]?.signedUrl;
    if (signed) m.imageUrl = signed;
  });
}

/** Messages in a conversation, oldest first (photo URLs signed for display). */
export async function fetchMessages(conversationId: string): Promise<DirectMessage[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  const msgs = (data ?? []).map(rowToMessage);
  await signMessagePhotos(msgs);
  return msgs;
}

/** Send a message (text, photo, and/or shared post); returns it or null. */
export async function sendMessage(
  conversationId: string,
  body: string,
  imageUrl?: string | null,
  postId?: string | null,
): Promise<DirectMessage | null> {
  const text = body.trim();
  if (!text && !imageUrl && !postId) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      body: text,
      image_url: imageUrl ?? null,
      post_id: postId ?? null,
    })
    .select()
    .single();
  if (error || !data) return null;
  return rowToMessage(data);
}

/** Mark the other party's messages in a conversation as read. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', uid)
    .is('read_at', null);
  // Clear the bell notification for this conversation so it stays in sync
  // with the inbox unread badge.
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', uid)
    .eq('type', 'message')
    .eq('entity_id', conversationId)
    .eq('read', false);
}
