import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Spacing } from '@/constants/theme';

/**
 * Standard header for secondary (non-tab) screens: an accessible, labeled back
 * button, a centered title, and an optional right-side action. Centralizing it
 * keeps the back control consistent and screen-reader friendly everywhere.
 */
export function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.side}>
        <IconSymbol name="chevron.left" size={26} color={Palette.text} />
      </Pressable>
      <Txt variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Txt>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  side: { minWidth: 26, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
});
