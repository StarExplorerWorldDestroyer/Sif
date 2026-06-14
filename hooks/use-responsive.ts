import { Platform, useWindowDimensions } from 'react-native';

/** Width (px) at and above which we switch to the desktop sidebar layout. */
export const DESKTOP_BREAKPOINT = 900;

/** True on web when the viewport is wide enough for the desktop layout. */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

/**
 * On desktop, returns a style that caps content width and centers it so
 * single-column screens don't stretch across the wide content area.
 * Returns null on mobile (no change).
 */
export function useCenteredContent(maxWidth = 760) {
  const isDesktop = useIsDesktop();
  return isDesktop ? { maxWidth, width: '100%' as const, alignSelf: 'center' as const } : null;
}

/** Number of grid columns for photo grids/feeds, responsive to width. */
export function useGridColumns(mobile = 3, desktop = 3): number {
  return useIsDesktop() ? desktop : mobile;
}
