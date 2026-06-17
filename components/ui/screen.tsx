import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Palette, Spacing } from '@/constants/theme';

/**
 * Standard screen wrapper: pure black background + safe-area padding so content
 * doesn't sit under the notch or home indicator. Wrap every screen in this.
 */
export function Screen({
  children,
  style,
  edges = ['top'],
  padded = true,
}: {
  children: ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.fill, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.black,
  },
  // Always fill the safe area so child scroll views get a bounded height to
  // scroll within (without this, padded={false} screens collapse to content
  // height and their ScrollView can't scroll).
  fill: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: Spacing.lg,
  },
});
