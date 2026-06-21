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
  // Warm near-black app background — echoes the landing page's holographic
  // backdrop so the whole product feels like one universe (vs. pure black).
  bg: '#0A0503',
  bgDeep: '#050201', // outer web backdrop, behind the app frame
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
 * Orange "hologram" glow for views (buttons, FABs, badges). The native shadow
 * props are converted to a CSS box-shadow on web by React Native Web, so this
 * one object works on every platform.
 */
export const Glow = {
  sm: {
    shadowColor: Palette.accent,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  md: {
    shadowColor: Palette.accent,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
} as const;

/** Orange text glow, matching the glowing wordmark on the landing page. */
export const TextGlow = {
  accent: {
    textShadowColor: 'rgba(255, 87, 51, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
} as const;

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
