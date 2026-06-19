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
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
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
                    imageUrl: m.image_url ?? null,
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

  const send = useCallback(async () => {
    const text = draft.trim();
    const localImage = pendingImage;
    if ((!text && !localImage) || sending || !user) return;
    setSending(true);
    setDraft('');
    setPendingImage(null);
    let imageUrl: string | null = null;
    if (localImage) {
      try {
        imageUrl = await uploadMessagePhoto(user.id, conversationId, localImage);
      } catch {
        setSending(false);
        setDraft(text);
        setPendingImage(localImage);
        Alert.alert('Upload failed', 'Could not send the photo. Please try again.');
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
  }, [draft, pendingImage, sending, user, conversationId, refetchInbox, scrollToEnd]);

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
              onChangeText={setDraft}
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
  messageImage: { width: 220, height: 220, borderRadius: Radius.md, backgroundColor: Palette.surface },
  captionAfterImage: { marginTop: Spacing.sm },
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
