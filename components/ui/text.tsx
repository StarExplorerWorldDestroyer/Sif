import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { FontSize, Palette } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const variantStyles = StyleSheet.create({
  display: { fontSize: FontSize.xxl, fontWeight: '300', color: Palette.text },
  title: { fontSize: FontSize.xl, fontWeight: '300', color: Palette.text },
  heading: { fontSize: FontSize.lg, fontWeight: '500', color: Palette.text },
  body: { fontSize: FontSize.md, fontWeight: '400', color: Palette.text },
  label: { fontSize: FontSize.sm, fontWeight: '400', color: Palette.textMuted },
  caption: { fontSize: FontSize.xs, fontWeight: '400', color: Palette.textDim },
});

/**
 * Themed text. Pick a `variant` for consistent sizing/weight, and optionally
 * override the `color` (e.g. the orange accent for prices/tips).
 */
export function Txt({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return <RNText style={[variantStyles[variant], color ? { color } : null, style]} {...rest} />;
}
