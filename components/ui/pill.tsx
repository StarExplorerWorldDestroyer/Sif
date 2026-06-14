import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';

/** A small rounded tag used for techniques, tools, and specialties. */
export function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View style={[styles.pill, accent && styles.accent]}>
      <Txt variant="label" color={accent ? Palette.accent : Palette.text}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  accent: {
    backgroundColor: Palette.accentSoft,
  },
});
