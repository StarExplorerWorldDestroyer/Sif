import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/use-responsive';

/**
 * Web layout wrapper.
 * - Narrow web (phones, small windows): center a phone-width column.
 * - Desktop/laptop: a wide, centered app surface (the sidebar layout lives
 *   inside, so this just caps the overall width on very large monitors).
 * - Native: no-op.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.frame, isDesktop ? styles.desktop : styles.phone]}>{children}</View>
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
    backgroundColor: Palette.black,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  phone: {
    maxWidth: 480,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  desktop: {
    maxWidth: 1240,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
