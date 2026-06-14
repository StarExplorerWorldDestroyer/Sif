import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

/** A dark surface card with rounded corners — the app's main content container. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
});
