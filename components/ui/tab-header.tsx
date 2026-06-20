import { Link, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useMessages } from '@/store/messages';
import { useNotifications } from '@/store/notifications';

/**
 * Consistent top bar shared across the main tabs. The title is always left
 * aligned at the same position, the notifications bell (with unread badge) is
 * always pinned top-right, and tab-specific `actions` sit just left of the bell.
 * Pass `titleHref` to make the title navigate (e.g. the Sif wordmark → Cuts).
 */
export function TabHeader({
  title,
  titleHref,
  actions,
}: {
  title: string;
  titleHref?: string;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { unreadTotal } = useMessages();
  const centered = useCenteredContent();

  return (
    <View style={styles.bar}>
      <View style={[styles.row, centered]}>
        {titleHref ? (
          <Link href={titleHref as never} asChild>
            <Pressable hitSlop={6} accessibilityRole="link" accessibilityLabel={`${title}, go to Cuts`}>
              <Txt variant="title" mono glow>{title}</Txt>
            </Pressable>
          </Link>
        ) : (
          <Txt variant="title" mono glow>{title}</Txt>
        )}

        <View style={styles.actions}>
          {actions}
          <Pressable
            style={styles.bellButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Messages${unreadTotal > 0 ? `, ${unreadTotal} unread` : ''}`}
            onPress={() => router.push('/messages')}>
            <IconSymbol name="bubble.right" size={22} color={Palette.text} />
            {unreadTotal > 0 ? (
              <View style={styles.badge}>
                <Txt variant="caption" color={Palette.black} style={styles.badgeText}>
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </Txt>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={styles.bellButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            onPress={() => router.push('/notifications')}>
            <IconSymbol name="bell" size={22} color={Palette.text} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Txt variant="caption" color={Palette.black} style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bellButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
});
