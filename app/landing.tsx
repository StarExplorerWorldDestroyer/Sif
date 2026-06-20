import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { SIF_ASCII_IMAGE } from '@/constants/sif-ascii';

const MONO = Platform.select({ ios: 'Courier', default: 'monospace' });

/**
 * Native landing page. The rich holographic/3D treatment lives in the web
 * variant (landing.web.tsx); on device we show the orange ASCII figure, the
 * GOLDEN SIF wordmark, and an Enter button into login.
 */
export default function Landing() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        horizontal={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={styles.ascii}>{SIF_ASCII_IMAGE}</Text>
        </ScrollView>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  content: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.lg },
  ascii: {
    fontFamily: MONO,
    color: Palette.accent,
    fontSize: 5,
    lineHeight: 5,
    padding: Spacing.lg,
  },
  title: { letterSpacing: 8, textAlign: 'center' },
  tagline: { letterSpacing: 4, textAlign: 'center' },
  enter: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  enterTxt: { letterSpacing: 10 },
});
