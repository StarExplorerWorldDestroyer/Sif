import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { computeCadence, describeCadence } from '@/lib/insights';
import { useHaircuts } from '@/store/haircuts';

/**
 * "You're due for a cut" nudge based on the user's own rhythm. Shows only once
 * there's enough history to estimate a cadence, and gets more prominent (accent
 * + CTA) when a cut is due or overdue.
 */
export function CutReminder() {
  const router = useRouter();
  const { haircuts } = useHaircuts();
  const cadence = useMemo(() => computeCadence(haircuts), [haircuts]);

  if (cadence.status === 'insufficient' || !cadence.predictedNext) return null;

  const every = describeCadence(cadence.cadenceDays);
  const urgent = cadence.status === 'overdue' || cadence.status === 'due_soon';

  let title: string;
  let subtitle: string;
  if (cadence.status === 'overdue') {
    const over = Math.abs(cadence.daysUntilDue);
    title = "You're due for a cut";
    subtitle = `It's been ${cadence.daysSinceLast} days — you usually go ${every} (${over} day${over === 1 ? '' : 's'} over).`;
  } else if (cadence.status === 'due_soon') {
    title = 'Almost time for a cut';
    subtitle = `About ${cadence.daysUntilDue} day${cadence.daysUntilDue === 1 ? '' : 's'} to your usual ${every} mark.`;
  } else {
    title = `Next cut around ${formatDate(cadence.predictedNext)}`;
    subtitle = `You typically get a cut ${every}.`;
  }

  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      <View style={[styles.iconWrap, urgent && styles.iconWrapUrgent]}>
        <IconSymbol
          name={urgent ? 'scissors' : 'clock'}
          size={20}
          color={urgent ? Palette.accent : Palette.textMuted}
        />
      </View>
      <View style={styles.body}>
        <Txt variant="label" color={Palette.text}>
          {title}
        </Txt>
        <Txt variant="caption" color={Palette.textMuted}>
          {subtitle}
        </Txt>
      </View>
      {urgent ? (
        <Pressable style={styles.cta} onPress={() => router.push('/add')} hitSlop={6}>
          <Txt variant="caption" color={Palette.black} style={styles.ctaText}>
            Log a cut
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  cardUrgent: { borderColor: Palette.accent, backgroundColor: Palette.accentSoft },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUrgent: { backgroundColor: Palette.black },
  body: { flex: 1, gap: 2 },
  cta: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  ctaText: { fontWeight: '700' },
});
