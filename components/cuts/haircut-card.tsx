import { AppImage as Image } from '@/components/ui/app-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { primaryPhotoUri } from '@/lib/photos';
import { useMoney } from '@/hooks/use-money';
import type { Haircut } from '@/types';

export function HaircutCard({ haircut, onPress }: { haircut: Haircut; onPress?: () => void }) {
  const money = useMoney();
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: primaryPhotoUri(haircut) }} style={styles.thumb} contentFit="cover" />

      <View style={styles.middle}>
        <Txt variant="heading" numberOfLines={1}>
          {haircut.cutType}
        </Txt>
        <Txt variant="label" numberOfLines={1}>
          {haircut.location} · {haircut.stylist.name}
        </Txt>

        <View style={styles.social}>
          <View style={styles.metric}>
            <IconSymbol name="heart" size={13} color={Palette.textMuted} />
            <Txt variant="caption">{haircut.likes}</Txt>
          </View>
          <View style={styles.metric}>
            <IconSymbol name="bubble.right" size={13} color={Palette.textMuted} />
            <Txt variant="caption">{haircut.comments}</Txt>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <Txt variant="body">{money(haircut.price + haircut.tip)}</Txt>
        <Txt variant="caption" color={Palette.accent}>
          +{money(haircut.tip)} tip
        </Txt>
        <Txt variant="caption">{formatDate(haircut.date)}</Txt>
        <IconSymbol name="chevron.right" size={14} color={Palette.textDim} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    gap: Spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  social: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
