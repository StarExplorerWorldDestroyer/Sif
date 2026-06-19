import { AppImage as Image } from '@/components/ui/app-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Pill } from '@/components/ui/pill';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { getStyleById } from '@/data/discover';
import { useCenteredContent } from '@/hooks/use-responsive';

const LENGTH_COLORS: Record<string, string> = {
  Buzzed: '#FF5733',
  Short: '#3DDC84',
  Medium: '#4DA3FF',
  Shoulder: '#C77DFF',
  Long: '#FFB020',
};

export default function DiscoverDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const centered = useCenteredContent(680);
  const style = getStyleById(id);

  if (!style) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Txt variant="label" color={Palette.textMuted}>
            That style isn&apos;t in the catalog.
          </Txt>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, centered]}>
        <View style={styles.hero}>
          <View style={[styles.symbol, { backgroundColor: LENGTH_COLORS[style.length] ?? Palette.accent }]}>
            <Txt variant="title" color={Palette.black} style={styles.symbolText}>
              {style.name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}
            </Txt>
          </View>
          <Txt variant="title">{style.name}</Txt>
          {style.alsoCalled?.length ? (
            <Txt variant="caption" color={Palette.textMuted}>
              Also called: {style.alsoCalled.join(', ')}
            </Txt>
          ) : null}
        </View>

        <View style={styles.attrs}>
          <Pill label={style.length} />
          <Pill label={`${style.maintenance} upkeep`} />
          {style.hairTypes.map((h) => (
            <Pill key={h} label={h} />
          ))}
        </View>

        <Txt variant="body" style={styles.summary}>
          {style.summary}
        </Txt>

        <Section title="Good for">
          {style.goodFor.map((g, i) => (
            <Bullet key={i} text={g} positive />
          ))}
        </Section>

        <Section title="Things to consider">
          {style.watchOuts.map((w, i) => (
            <Bullet key={i} text={w} />
          ))}
        </Section>

        <Section title="Works with">
          <Txt variant="label" color={Palette.textMuted}>
            Curl patterns: {style.hairTypes.join(', ')}
          </Txt>
          <Txt variant="label" color={Palette.textMuted}>
            Hair texture: {style.textures.join(', ')}
          </Txt>
        </Section>

        <Section title="A little history">
          <Txt variant="label" color={Palette.textMuted} style={styles.history}>
            {style.history}
          </Txt>
        </Section>

        <Section title="Examples">
          {style.examples.length > 0 ? (
            <View style={styles.exampleGrid}>
              {style.examples.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.example} contentFit="cover" />
              ))}
            </View>
          ) : (
            <View style={styles.examplePlaceholder}>
              <IconSymbol name="sparkles" size={22} color={Palette.textDim} />
              <Txt variant="label" color={Palette.textMuted} style={styles.placeholderText}>
                Example photos across different hair types and people are coming soon.
              </Txt>
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <IconSymbol name="chevron.left" size={26} color={Palette.text} />
      </Pressable>
      <Txt variant="heading">Discover</Txt>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="caption" style={styles.sectionTitle}>
        {title}
      </Txt>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Bullet({ text, positive }: { text: string; positive?: boolean }) {
  return (
    <View style={styles.bullet}>
      <IconSymbol
        name={positive ? 'checkmark' : 'eye'}
        size={16}
        color={positive ? Palette.success : Palette.textMuted}
      />
      <Txt variant="label" style={styles.bulletText}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  symbol: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: { fontWeight: '800' },
  attrs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  summary: { lineHeight: 24, marginBottom: Spacing.md },
  section: { marginTop: Spacing.lg },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  sectionBody: { gap: Spacing.xs },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  bulletText: { flex: 1, lineHeight: 20 },
  history: { lineHeight: 20 },
  exampleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  example: { width: '32%', aspectRatio: 1, borderRadius: Radius.sm, backgroundColor: Palette.surfaceAlt },
  examplePlaceholder: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.lg,
  },
  placeholderText: { textAlign: 'center' },
});
