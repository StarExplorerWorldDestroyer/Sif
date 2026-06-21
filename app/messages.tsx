import { AppImage as Image } from '@/components/ui/app-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useRefresh } from '@/hooks/use-refresh';
import { timeAgoShort } from '@/lib/time-ago';
import { useAuth } from '@/store/auth';
import { useMessages } from '@/store/messages';
import type { Conversation } from '@/types';

export default function MessagesScreen() {
  const router = useRouter();
  const centered = useCenteredContent(680);
  const { user } = useAuth();
  const { conversations, loading, refetch } = useMessages();
  const { refreshing, onRefresh } = useRefresh(refetch);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Messages"
        right={
          <Pressable
            onPress={() => router.push('/messages/new')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New message">
            <IconSymbol name="square.and.pencil" size={26} color={Palette.accent} />
          </Pressable>
        }
      />

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
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />
          }
          renderItem={({ item: c }) => (
            <Row
              conversation={c}
              mine={c.lastSender === user?.id}
              onPress={() => router.push(`/messages/${c.id}?other=${c.other.id}`)}
            />
          )}
        />
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
        <Image
          source={{ uri: other.avatarUrl }}
          style={styles.avatar}
          contentFit="cover"
          recyclingKey={other.id}
        />
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
            {timeAgoShort(lastMessageAt)}
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
