import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppImage as Image } from '@/components/ui/app-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { UserSearchResult } from '@/types';

type Props = {
  user: UserSearchResult;
  /** Trailing element (chevron, action icon, spinner, etc.). */
  trailing?: ReactNode;
  /** Append " · private" to non-public handles. Defaults to true. */
  showPrivacy?: boolean;
};

/**
 * The avatar + name + @username body of a people-search result. Wrap it in a
 * Pressable or Link (and pass a `trailing` icon) for the screen's behavior.
 */
export function UserResultRow({ user, trailing, showPrivacy = true }: Props) {
  return (
    <View style={styles.row}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.placeholder]}>
          <IconSymbol name="person.fill" size={18} color={Palette.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Txt variant="body" numberOfLines={1}>
            {user.displayName || user.username || 'Sif user'}
          </Txt>
          {user.isStylist ? (
            <View style={styles.stylistBadge}>
              <Txt variant="caption" color={Palette.black}>
                Stylist
              </Txt>
            </View>
          ) : null}
        </View>
        {user.username ? (
          <Txt variant="caption" color={Palette.textMuted}>
            @{user.username}
            {showPrivacy && user.privacy !== 'public' ? ' · private' : ''}
          </Txt>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stylistBadge: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
});
