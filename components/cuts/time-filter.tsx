import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { TIME_RANGES, type TimeRange } from '@/lib/format';

export function TimeFilter({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <View style={styles.row}>
      {TIME_RANGES.map((range) => {
        const active = range === value;
        return (
          <Pressable
            key={range}
            onPress={() => onChange(range)}
            style={[styles.button, active && styles.buttonActive]}>
            <Txt
              variant="label"
              color={active ? Palette.black : Palette.textMuted}
              style={active ? styles.activeText : undefined}>
              {range}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    alignItems: 'center',
    backgroundColor: Palette.surface,
  },
  buttonActive: {
    backgroundColor: Palette.accent,
  },
  activeText: {
    fontWeight: '600',
  },
});
