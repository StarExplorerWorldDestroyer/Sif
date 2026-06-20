import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';

type IconName = ComponentProps<typeof IconSymbol>['name'];

/**
 * A consistent, friendly empty/zero state: a soft accent icon badge, a title,
 * supporting copy, and optional primary + secondary calls to action. Use this
 * everywhere a list/screen can be empty so the app feels intentional, not blank.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <IconSymbol name={icon} size={32} color={Palette.accent} />
      </View>
      <Txt variant="heading" style={styles.title}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="label" style={styles.subtitle}>
          {subtitle}
        </Txt>
      ) : null}
      {primaryLabel && onPrimary ? (
        <Pressable style={styles.primary} onPress={onPrimary}>
          <Txt variant="body" color={Palette.black} style={styles.primaryText}>
            {primaryLabel}
          </Txt>
        </Pressable>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable style={styles.secondary} onPress={onSecondary} hitSlop={8}>
          <Txt variant="label" color={Palette.textMuted}>
            {secondaryLabel}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', maxWidth: 300, color: Palette.textMuted },
  primary: {
    marginTop: Spacing.md,
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    ...Glow.md,
  },
  primaryText: { fontWeight: '600' },
  secondary: { marginTop: Spacing.sm, paddingVertical: Spacing.xs },
});
