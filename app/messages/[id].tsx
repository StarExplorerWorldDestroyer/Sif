import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import {
  fetchConversationOther,
  fetchMessages,
  markConversationRead,
  sendMessage,
} from '@/lib/messages';
import { uploadMessagePhoto } from '@/lib/photos';
import { fetchCardsByIds, fetchPublicPostsByIds } from '@/lib/public';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';
import { useMessages } from '@/store/messages';
import type { DirectMessage, PublicPost, UserSearchResult } from '@/types';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; other?: string }>();
  const conversationId = params.id;
  const centered = useCenteredContent(680);
  const { user } = useAuth();
  const { toast } = useFeedback();
  const { refetch: refetchInbox } = useMessages();

  const [other, setOther] = useState<UserSearchResult | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sharedPosts, setSharedPosts] = useState<Record<string, PublicPost>>({});
  const scrollRef = useRef<ScrollView>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Resolve the other participant (from param when available, else the row).
  useEffect(() => {
    let active = true;
    (async () => {
      if (params.other) {
        const cards = await fetchCardsByIds([params.other]);
        if (active && cards[0]) setOther(cards[0]);
      } else if (user) {
        const o = await fetchConversationOther(conversationId, user.id);
        if (active) setOther(o);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.other, conversationId, user]);

  const markRead = useCallback(async () => {
    await markConversationRead(conversationId);
    refetchInbox();
  }, [conversationId, refetchInbox]);

  // Initial load.
  useEffect(() => {
    let active = true;
    (async () => {
      const msgs = await fetchMessages(conversationId);
      if (!active) return;
      setMessages(msgs);
      setLoading(false);
      markRead();
      scrollToEnd();
    })();
    return () => {
      active = false;
    };
  }, [conversationId, markRead, scrollToEnd]);

  // Live updates for this thread.
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: m.id,
                    conversationId: m.conversation_id,
                    senderId: m.sender_id,
                    body: m.body ?? '',
                    imageUrl: m.image_url ?? null,
                    postId: m.post_id ?? null,
                    createdAt: m.created_at,
                    readAt: m.read_at ?? null,
                  },
                ],
          );
          if (m.sender_id !== user?.id) markRead();
          scrollToEnd();
        },
      )
      .on(
        // Read receipts: the other party marking my messages read updates
        // read_at, so reflect "Seen" live.
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, readAt: m.read_at ?? null } : x)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, markRead, scrollToEnd]);

  // Ephemeral typing indicator over a broadcast channel (no DB writes).
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        setOtherTyping(true);
        if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        typingClearTimer.current = setTimeout(() => setOtherTyping(false), 3500);
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        setOtherTyping(false);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId, user]);

  // Resolve shared posts referenced by messages (fetch any we don't have yet).
  useEffect(() => {
    const missing = Array.from(
      new Set(messages.map((m) => m.postId).filter((id): id is string => !!id)),
    ).filter((id) => !sharedPosts[id]);
    if (missing.length === 0) return;
    let active = true;
    (async () => {
      const posts = await fetchPublicPostsByIds(missing);
      if (!active || posts.length === 0) return;
      setSharedPosts((prev) => {
        const next = { ...prev };
        for (const p of posts) next[p.id] = p;
        return next;
      });
    })();
    return () => {
      active = false;
    };
  }, [messages, sharedPosts]);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (!user || !typingChannelRef.current) return;
      const now = Date.now();
      if (text.length > 0 && now - lastTypingSentRef.current > 1500) {
        lastTypingSentRef.current = now;
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id },
        });
      }
    },
    [user],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    const localImage = pendingImage;
    if ((!text && !localImage) || sending || !user) return;
    setSending(true);
    setDraft('');
    setPendingImage(null);
    lastTypingSentRef.current = 0;
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { userId: user.id },
    });
    let imageUrl: string | null = null;
    if (localImage) {
      try {
        imageUrl = await uploadMessagePhoto(user.id, conversationId, localImage);
      } catch {
        setSending(false);
        setDraft(text);
        setPendingImage(localImage);
        toast('Could not send the photo. Please try again.', { tone: 'error' });
        return;
      }
    }
    const msg = await sendMessage(conversationId, text, imageUrl);
    setSending(false);
    if (msg) {
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      refetchInbox();
      scrollToEnd();
    } else {
      setDraft(text);
      setPendingImage(localImage);
    }
  }, [draft, pendingImage, sending, user, conversationId, refetchInbox, scrollToEnd, toast]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to send a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    setPendingImage(result.assets[0].uri);
  }, []);

  const takeImage = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    setPendingImage(result.assets[0].uri);
  }, []);

  const choosePhoto = useCallback(() => {
    if (Platform.OS === 'web') {
      pickImage();
      return;
    }
    Alert.alert('Send a photo', undefined, [
      { text: 'Take Photo', onPress: takeImage },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage, takeImage]);

  const name = other?.displayName || (other?.username ? `@${other.username}` : 'Sif user');

  // The most recent of my messages the other party has read → show "Seen".
  let lastSeenMineId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderId === user?.id && messages[i].readAt) {
      lastSeenMineId = messages[i].id;
      break;
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Pressable
          style={styles.headerWho}
          onPress={() => (other?.username ? router.push(`/u/${other.username}`) : undefined)}>
          {other?.avatarUrl ? (
            <Image source={{ uri: other.avatarUrl }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
              <IconSymbol name="person.fill" size={14} color={Palette.textMuted} />
            </View>
          )}
          <Txt variant="heading" numberOfLines={1}>
            {name}
          </Txt>
        </Pressable>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Palette.accent} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.content, centered]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}>
            {messages.length === 0 ? (
              <Txt variant="label" color={Palette.textMuted} style={styles.emptyHint}>
                Say hi to {name}.
              </Txt>
            ) : (
              messages.map((m, i) => {
                const mine = m.senderId === user?.id;
                const prev = messages[i - 1];
                const showDay =
                  !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                return (
                  <View key={m.id}>
                    {showDay ? (
                      <Txt variant="caption" color={Palette.textDim} style={styles.dayDivider}>
                        {dayLabel(m.createdAt)}
                      </Txt>
                    ) : null}
                    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                      <View
                        style={[
                          styles.bubble,
                          mine ? styles.bubbleMine : styles.bubbleTheirs,
                          m.imageUrl && !m.body ? styles.bubbleImageOnly : null,
                        ]}>
                        {m.imageUrl ? (
                          <Pressable onPress={() => setViewing(m.imageUrl)}>
                            <Image source={{ uri: m.imageUrl }} style={styles.messageImage} contentFit="cover" />
                          </Pressable>
                        ) : null}
                        {m.postId ? (
                          <SharedPostCard
                            post={sharedPosts[m.postId]}
                            mine={mine}
                            onPress={() => router.push(`/p/${m.postId}`)}
                          />
                        ) : null}
                        {m.body ? (
                          <Txt
                            variant="body"
                            color={mine ? Palette.black : Palette.text}
                            style={m.imageUrl ? styles.captionAfterImage : undefined}>
                            {m.body}
                          </Txt>
                        ) : null}
                        <Txt
                          variant="caption"
                          color={mine ? 'rgba(0,0,0,0.55)' : Palette.textDim}
                          style={styles.time}>
                          {timeLabel(m.createdAt)}
                        </Txt>
                      </View>
                    </View>
                    {m.id === lastSeenMineId ? (
                      <Txt variant="caption" color={Palette.textDim} style={styles.seen}>
                        Seen
                      </Txt>
                    ) : null}
                  </View>
                );
              })
            )}
            {otherTyping ? (
              <View style={[styles.bubbleRow, styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
                  <Txt variant="label" color={Palette.textMuted}>
                    {name.split(' ')[0]} is typing…
                  </Txt>
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}

        <View style={[styles.composerWrap, centered]}>
          {pendingImage ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: pendingImage }} style={styles.previewImage} contentFit="cover" />
              <Pressable
                style={styles.previewRemove}
                onPress={() => setPendingImage(null)}
                hitSlop={8}>
                <IconSymbol name="xmark" size={14} color={Palette.text} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <Pressable style={styles.attach} onPress={choosePhoto} hitSlop={8} disabled={sending}>
              <IconSymbol name="camera.fill" size={22} color={Palette.textMuted} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Message…"
              placeholderTextColor={Palette.textDim}
              style={styles.input}
              multiline
              onSubmitEditing={send}
            />
            <Pressable
              style={[
                styles.send,
                ((!draft.trim() && !pendingImage) || sending) && styles.sendDisabled,
              ]}
              onPress={send}
              disabled={(!draft.trim() && !pendingImage) || sending}>
              {sending ? (
                <ActivityIndicator color={Palette.black} size="small" />
              ) : (
                <IconSymbol name="paperplane.fill" size={18} color={Palette.black} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.lightbox} onPress={() => setViewing(null)}>
          {viewing ? (
            <Image source={{ uri: viewing }} style={styles.lightboxImage} contentFit="contain" />
          ) : null}
          <Pressable style={styles.lightboxClose} onPress={() => setViewing(null)} hitSlop={8}>
            <IconSymbol name="xmark" size={26} color={Palette.text} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SharedPostCard({
  post,
  mine,
  onPress,
}: {
  post: PublicPost | undefined;
  mine: boolean;
  onPress: () => void;
}) {
  const author = post
    ? post.author.username
      ? `@${post.author.username}`
      : post.author.displayName || 'Sif user'
    : null;
  return (
    <Pressable style={[styles.sharedCard, mine ? styles.sharedCardMine : null]} onPress={onPress}>
      {post?.photoUrl ? (
        <Image source={{ uri: post.photoUrl }} style={styles.sharedThumb} contentFit="cover" />
      ) : (
        <View style={[styles.sharedThumb, styles.avatarPlaceholder]}>
          <IconSymbol name="scissors" size={18} color={Palette.textMuted} />
        </View>
      )}
      <View style={styles.sharedMeta}>
        <Txt variant="caption" color={mine ? 'rgba(0,0,0,0.55)' : Palette.textDim}>
          Shared a post
        </Txt>
        {post ? (
          <>
            <Txt variant="label" color={mine ? Palette.black : Palette.text} numberOfLines={1}>
              {author}
            </Txt>
            {post.caption ? (
              <Txt
                variant="caption"
                color={mine ? 'rgba(0,0,0,0.7)' : Palette.textMuted}
                numberOfLines={2}>
                {post.caption}
              </Txt>
            ) : null}
          </>
        ) : (
          <Txt variant="caption" color={mine ? 'rgba(0,0,0,0.7)' : Palette.textMuted}>
            Tap to view
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  headerWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
  headerAvatar: { width: 28, height: 28, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.lg, gap: 2, flexGrow: 1 },
  emptyHint: { textAlign: 'center', marginTop: Spacing.xxl },
  dayDivider: { textAlign: 'center', marginVertical: Spacing.md },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  bubbleMine: { backgroundColor: Palette.accent, borderBottomRightRadius: Radius.sm },
  bubbleTheirs: { backgroundColor: Palette.surfaceAlt, borderBottomLeftRadius: Radius.sm },
  bubbleImageOnly: { padding: 4 },
  typingBubble: { paddingVertical: Spacing.sm },
  messageImage: { width: 220, height: 220, borderRadius: Radius.md, backgroundColor: Palette.surface },
  captionAfterImage: { marginTop: Spacing.sm },
  sharedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: 240,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  sharedCardMine: { backgroundColor: 'rgba(0,0,0,0.12)' },
  sharedThumb: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Palette.surface },
  sharedMeta: { flex: 1, gap: 1 },
  time: { marginTop: 2, alignSelf: 'flex-end' },
  seen: { alignSelf: 'flex-end', marginTop: 2, marginRight: 2 },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  previewRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  previewImage: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Palette.surface },
  previewRemove: {
    position: 'absolute',
    top: Spacing.sm - 6,
    left: Spacing.lg + 60,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  attach: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxClose: { position: 'absolute', top: Spacing.xl, right: Spacing.lg },
  input: {
    flex: 1,
    color: Palette.text,
    fontSize: 15,
    maxHeight: 120,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
