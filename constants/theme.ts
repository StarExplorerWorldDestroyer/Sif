/**
 * Design tokens for the Haircuts app.
 *
 * This is the single source of truth for colors, spacing, radii, and type sizes.
 * Change a value here and it updates everywhere it's used.
 *
 * Aesthetic: dark-mode only, black background with an orange accent
 * (inspired by minimalist finance apps like Robinhood).
 */

import { Platform } from 'react-native';

/** Raw color values used throughout the app. */
export const Palette = {
  // Backgrounds
  black: '#000000',
  surface: '#1F1F1F', // cards
  surfaceAlt: '#2D2D2D', // raised elements, pills
  border: '#2D2D2D',

  // Text
  text: '#FFFFFF',
  textMuted: '#9BA1A6',
  textDim: '#6B6B6B',

  // Accent
  accent: '#FF5733',
  accentSoft: 'rgba(255, 87, 51, 0.15)',

  // Status
  success: '#3DDC84',
} as const;

/** Consistent spacing scale (in points). */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner radii. `pill` makes fully-rounded shapes. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Font sizes. */
export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

/**
 * Navigation theme colors. The app is dark-only, so light mirrors dark
 * to avoid any flash of a light theme on slower devices.
 */
const darkColors = {
  text: Palette.text,
  background: Palette.black,
  tint: Palette.accent,
  icon: Palette.textMuted,
  tabIconDefault: Palette.textMuted,
  tabIconSelected: Palette.accent,
};

export const Colors = {
  light: darkColors,
  dark: darkColors,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
