import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { fetchCardsByIds } from '@/lib/public';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useMessages } from '@/store/messages';
import type { DirectMessage, UserSearchResult } from '@/types';

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
  const { refetch: refetchInbox } = useMessages();

  const [other, setOther] = useState<UserSearchResult | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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
                    createdAt: m.created_at,
                    readAt: m.read_at ?? null,
                  },
                ],
          );
          if (m.sender_id !== user?.id) markRead();
          scrollToEnd();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, markRead, scrollToEnd]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const msg = await sendMessage(conversationId, text);
    setSending(false);
    if (msg) {
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      refetchInbox();
      scrollToEnd();
    } else {
      setDraft(text);
    }
  }, [draft, sending, conversationId, refetchInbox, scrollToEnd]);

  const name = other?.displayName || (other?.username ? `@${other.username}` : 'Sif user');

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
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Txt variant="body" color={mine ? Palette.black : Palette.text}>
                          {m.body}
                        </Txt>
                        <Txt
                          variant="caption"
                          color={mine ? 'rgba(0,0,0,0.55)' : Palette.textDim}
                          style={styles.time}>
                          {timeLabel(m.createdAt)}
                        </Txt>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={[styles.composer, centered]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={Palette.textDim}
            style={styles.input}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            style={[styles.send, (!draft.trim() || sending) && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim() || sending}>
            <IconSymbol name="paperplane.fill" size={18} color={Palette.black} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  time: { marginTop: 2, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
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
