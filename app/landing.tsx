import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppImage as Image } from '@/components/ui/app-image';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Spacing, TextGlow } from '@/constants/theme';

const HERO = require('../assets/brand/sif-holo-reference.png');

/**
 * Native landing page. The web variant (landing.web.tsx) renders Sif as a live
 * 3D hologram; on device we show the same holographic figure as a glowing image
 * with a pulsing halo, the GOLDEN SIF wordmark, and an Enter button into login.
 */
export default function Landing() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const heroSize = Math.min(width * 0.92, 460);

  // Slow "hologram" breathing: the figure and its halo gently pulse.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const heroOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={[styles.heroWrap, { width: heroSize, height: heroSize }]}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.haloCenter, { opacity: haloOpacity }]}>
            <Animated.View
              style={[
                styles.halo,
                { width: heroSize * 0.55, height: heroSize * 0.55, transform: [{ scale: haloScale }] },
              ]}
            />
          </Animated.View>
          <Animated.View style={[styles.heroFill, { opacity: heroOpacity }]}>
            <Image source={HERO} style={styles.heroFill} contentFit="contain" transition={600} />
          </Animated.View>
        </View>

        <Txt variant="display" color={Palette.accent} style={styles.title}>
          GOLDEN SIF
        </Txt>
        <Txt variant="caption" color={Palette.textMuted} style={styles.tagline}>
          GODDESS OF THE GOLDEN HAIR
        </Txt>

        <Pressable
          style={styles.enter}
          onPress={() => router.push('/login')}
          accessibilityRole="button"
          accessibilityLabel="Enter Golden Sif">
          <Txt variant="label" color={Palette.accent} style={styles.enterTxt}>
            ENTER
          </Txt>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  heroWrap: { alignItems: 'center', justifyContent: 'center' },
  heroFill: { width: '100%', height: '100%' },
  haloCenter: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    borderRadius: 9999,
    backgroundColor: Palette.accentSoft,
    ...Glow.md,
  },
  title: { letterSpacing: 8, textAlign: 'center', ...TextGlow.accent },
  tagline: { letterSpacing: 4, textAlign: 'center' },
  enter: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    ...Glow.sm,
  },
  enterTxt: { letterSpacing: 10 },
});
