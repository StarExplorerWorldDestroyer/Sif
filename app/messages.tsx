import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import { useMessages } from '@/store/messages';
import type { Conversation } from '@/types';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
  const router = useRouter();
  const centered = useCenteredContent(680);
  const { user } = useAuth();
  const { conversations, loading, refetch } = useMessages();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Messages</Txt>
        <Pressable onPress={() => router.push('/messages/new')} hitSlop={8}>
          <IconSymbol name="square.and.pencil" size={26} color={Palette.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="bubble.right"
          title="No messages yet"
          subtitle="Start a conversation here, or from someone's profile or a booking. Your chats show up here."
          primaryLabel="New message"
          onPrimary={() => router.push('/messages/new')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}>
          {conversations.map((c) => (
            <Row
              key={c.id}
              conversation={c}
              mine={c.lastSender === user?.id}
              onPress={() => router.push(`/messages/${c.id}?other=${c.other.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({
  conversation,
  mine,
  onPress,
}: {
  conversation: Conversation;
  mine: boolean;
  onPress: () => void;
}) {
  const { other, lastMessage, lastMessageAt, unread } = conversation;
  const name = other.displayName || (other.username ? `@${other.username}` : 'Sif user');
  const preview = lastMessage ? `${mine ? 'You: ' : ''}${lastMessage}` : 'No messages yet';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {other.avatarUrl ? (
        <Image source={{ uri: other.avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <IconSymbol name="person.fill" size={18} color={Palette.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.topLine}>
          <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </Txt>
          <Txt variant="caption" color={Palette.textDim}>
            {timeAgo(lastMessageAt)}
          </Txt>
        </View>
        <Txt
          variant="label"
          color={unread > 0 ? Palette.text : Palette.textMuted}
          numberOfLines={1}>
          {preview}
        </Txt>
      </View>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Txt variant="caption" color={Palette.black} style={styles.badgeText}>
            {unread > 9 ? '9+' : unread}
          </Txt>
        </View>
      ) : null}
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
    paddingVertical: Spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  avatar: { width: 48, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
