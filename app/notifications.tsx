import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useNotifications } from '@/store/notifications';
import type { AppNotification } from '@/types';

function actorName(n: AppNotification) {
  return n.actor?.displayName || (n.actor?.username ? `@${n.actor.username}` : 'Someone');
}

function message(n: AppNotification): string {
  const name = actorName(n);
  switch (n.type) {
    case 'connection_request':
      return `${name} sent you a connection request`;
    case 'connection_accepted':
      return `${name} accepted your connection request`;
    case 'follow':
      return `${name} started following you`;
    case 'pending_cut':
      return `${name} sent you a new cut to review`;
    case 'post_tag':
      return `${name} tagged you in a post`;
    default:
      return name;
  }
}

function href(n: AppNotification): string {
  switch (n.type) {
    case 'connection_request':
      return '/connections';
    case 'pending_cut':
      return '/pending';
    case 'post_tag':
      return n.entityId ? `/p/${n.entityId}` : '/';
    case 'connection_accepted':
    case 'follow':
      return n.actor?.username ? `/u/${n.actor.username}` : '/connections';
    default:
      return '/connections';
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const centered = useCenteredContent(640);
  const { notifications, loading, refetch, markAllRead } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      refetch().then(markAllRead);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Notifications</Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <IconSymbol name="bell" size={32} color={Palette.textDim} />
          <Txt variant="label" color={Palette.textMuted} style={{ marginTop: Spacing.md }}>
            You&apos;re all caught up.
          </Txt>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}>
          {notifications.map((n) => (
            <NotifLink key={n.id} to={href(n)} style={[styles.row, !n.read && styles.unreadRow]}>
              <Avatar uri={n.actor?.avatarUrl ?? ''} type={n.type} />
              <View style={{ flex: 1 }}>
                <Txt variant="body">{message(n)}</Txt>
                <Txt variant="caption" color={Palette.textMuted}>
                  {timeAgo(n.createdAt)}
                </Txt>
              </View>
              {!n.read ? <View style={styles.dot} /> : null}
            </NotifLink>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotifLink({
  to,
  style,
  children,
}: {
  to: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Link href={to as never} asChild>
      <Pressable style={style}>{children}</Pressable>
    </Link>
  );
}

function Avatar({ uri, type }: { uri: string; type: AppNotification['type'] }) {
  const icon =
    type === 'pending_cut' || type === 'post_tag'
      ? 'scissors'
      : type === 'follow'
        ? 'person.fill'
        : 'person.2.fill';
  if (uri) return <Image source={{ uri }} style={styles.avatar} contentFit="cover" />;
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <IconSymbol name={icon} size={18} color={Palette.textMuted} />
    </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  unreadRow: { backgroundColor: Palette.surface },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.accent },
});
