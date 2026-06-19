import { Image, type ImageProps } from 'expo-image';

/**
 * App-wide image with a gentle fade-in so photos and avatars resolve smoothly
 * instead of popping in. A drop-in replacement for expo-image's `Image`:
 * `source`, `style`, `contentFit`, etc. pass straight through, and callers can
 * still override `transition` when they need to.
 */
export function AppImage(props: ImageProps) {
  return <Image transition={250} {...props} />;
}
