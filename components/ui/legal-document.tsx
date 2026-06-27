import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';

export type LegalSection = { heading: string; body: string[] };

/**
 * Renders a simple legal document (privacy policy, terms) from structured
 * sections. Lines beginning with "• " render as bullet rows. These screens are
 * intentionally reachable while logged out so the App Store privacy URL and
 * in-app links resolve for anyone.
 */
export function LegalDocument({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
}) {
  const centered = useCenteredContent(720);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={title} />
      <ScrollView
        contentContainerStyle={[styles.content, centered ?? undefined]}
        showsVerticalScrollIndicator={false}>
        <Txt variant="caption" style={styles.updated}>
          Effective {effectiveDate}
        </Txt>
        <Txt variant="body" style={styles.intro}>
          {intro}
        </Txt>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Txt variant="heading" style={styles.sectionHeading}>
              {section.heading}
            </Txt>
            {section.body.map((line, i) =>
              line.startsWith('• ') ? (
                <View key={i} style={styles.bulletRow}>
                  <Txt variant="body" color={Palette.textMuted} style={styles.bulletDot}>
                    •
                  </Txt>
                  <Txt variant="body" color={Palette.textMuted} style={styles.bulletText}>
                    {line.slice(2)}
                  </Txt>
                </View>
              ) : (
                <Txt key={i} variant="body" color={Palette.textMuted} style={styles.paragraph}>
                  {line}
                </Txt>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  updated: { marginBottom: Spacing.md },
  intro: { marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.xl },
  sectionHeading: { marginBottom: Spacing.sm },
  paragraph: { marginBottom: Spacing.sm, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', marginBottom: Spacing.xs, paddingRight: Spacing.md },
  bulletDot: { width: 18, lineHeight: 22 },
  bulletText: { flex: 1, lineHeight: 22 },
});
