import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { FontSize, Fonts, Palette, TextGlow } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const variantStyles = StyleSheet.create({
  display: { fontSize: FontSize.xxl, fontWeight: '300', color: Palette.text },
  title: { fontSize: FontSize.xl, fontWeight: '300', color: Palette.text },
  heading: { fontSize: FontSize.lg, fontWeight: '500', color: Palette.text },
  body: { fontSize: FontSize.md, fontWeight: '400', color: Palette.text },
  label: { fontSize: FontSize.sm, fontWeight: '400', color: Palette.textMuted },
  caption: { fontSize: FontSize.xs, fontWeight: '400', color: Palette.textDim },
});

const extras = StyleSheet.create({
  mono: { fontFamily: Fonts.mono },
  glow: TextGlow.accent,
});

/**
 * Themed text. Pick a `variant` for consistent sizing/weight, and optionally
 * override the `color` (e.g. the orange accent for prices/tips).
 *
 * - `mono` switches to the monospace "data terminal" face (brand, numbers).
 * - `glow` adds the orange holographic text glow from the landing page.
 */
export function Txt({
  variant = 'body',
  color,
  mono,
  glow,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; mono?: boolean; glow?: boolean }) {
  return (
    <RNText
      style={[
        variantStyles[variant],
        mono && extras.mono,
        glow && extras.glow,
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}
