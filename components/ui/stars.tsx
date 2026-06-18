import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/theme';

/** Read-only star row that shows a fractional rating (e.g. 4.3). */
export function StarRating({
  value,
  size = 14,
  color = Palette.accent,
}: {
  value: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star.fill' : value >= i - 0.5 ? 'star.leadinghalf.filled' : 'star';
        return <IconSymbol key={i} name={name} size={size} color={color} />;
      })}
    </View>
  );
}

/** Tappable 1–5 star input. */
export function StarPicker({
  value,
  onChange,
  size = 34,
  color = Palette.accent,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  color?: string;
}) {
  return (
    <View style={styles.pickerRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} accessibilityLabel={`${i} star`}>
          <IconSymbol name={value >= i ? 'star.fill' : 'star'} size={size} color={color} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
