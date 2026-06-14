import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/theme';

/**
 * On web/desktop, constrains the app to a centered phone-width column so it
 * doesn't stretch edge-to-edge on large screens. On native this is a no-op.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.backdrop}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: Palette.black,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
});
