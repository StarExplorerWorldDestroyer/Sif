import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { computeCadence, describeCadence } from '@/lib/insights';
import { dueReminder, formatReminderDate, relativeDays } from '@/lib/reminders';
import { useHaircuts } from '@/store/haircuts';
import { useProfile } from '@/store/profile';

/**
 * Drives the "time for a cut" nudge on the Cuts tab. Prefers the user's
 * explicitly configured reminder; otherwise falls back to an estimate from
 * their cut cadence, and always offers a way to set/edit the reminder.
 */
export function CutReminder() {
  const router = useRouter();
  const { haircuts } = useHaircuts();
  const { profile } = useProfile();

  const lastCut = haircuts[0]?.date ?? null;
  const reminder = profile?.cutReminder ?? null;
  const cadence = useMemo(() => computeCadence(haircuts), [haircuts]);
  const state = useMemo(
    () => (reminder ? dueReminder(reminder.rule, lastCut) : null),
    [reminder, lastCut],
  );

  const openEditor = () => router.push('/reminder');
  const logCut = () => router.push('/add');

  // 1) An explicit reminder is set — show its status.
  if (reminder && state) {
    const urgent = state.status === 'overdue' || state.status === 'due' || state.status === 'soon';
    const dateLabel = formatReminderDate(state.date);
    let title: string;
    let subtitle: string;
    if (state.status === 'overdue') {
      title = "You're due for a cut";
      subtitle = `Your reminder was ${relativeDays(state.daysUntil)} (${dateLabel}).`;
    } else if (state.status === 'due') {
      title = 'Time for a cut';
      subtitle = `Your reminder is for today, ${dateLabel}.`;
    } else if (state.status === 'soon') {
      title = 'Almost time for a cut';
      subtitle = `Reminder ${relativeDays(state.daysUntil)} · ${dateLabel}.`;
    } else {
      title = `Next cut ${relativeDays(state.daysUntil)}`;
      subtitle = `Reminder set for ${dateLabel}.`;
    }
    return (
      <Card urgent={urgent} icon={urgent ? 'scissors' : 'bell'} title={title} subtitle={subtitle}>
        {urgent ? <Cta label="Log a cut" onPress={logCut} /> : null}
        <EditButton onPress={openEditor} />
      </Card>
    );
  }

  // 2) No reminder, but enough history to estimate a rhythm.
  if (cadence.status !== 'insufficient' && cadence.predictedNext) {
    const every = describeCadence(cadence.cadenceDays);
    const urgent = cadence.status === 'overdue' || cadence.status === 'due_soon';
    const title = urgent ? "You're about due for a cut" : `Next cut around ${formatDate(cadence.predictedNext)}`;
    const subtitle = urgent
      ? `It's been ${cadence.daysSinceLast} days — you usually go ${every}.`
      : `You typically get a cut ${every}. Set a reminder?`;
    return (
      <Card urgent={urgent} icon={urgent ? 'scissors' : 'clock'} title={title} subtitle={subtitle}>
        {urgent ? <Cta label="Log a cut" onPress={logCut} /> : null}
        <Cta label="Set reminder" onPress={openEditor} subtle={urgent} />
      </Card>
    );
  }

  // 3) Nothing to estimate yet — offer to set a reminder.
  return (
    <Pressable style={[styles.card, styles.setPrompt]} onPress={openEditor}>
      <View style={styles.iconWrap}>
        <IconSymbol name="bell" size={20} color={Palette.textMuted} />
      </View>
      <View style={styles.body}>
        <Txt variant="label" color={Palette.text}>
          Set a cut reminder
        </Txt>
        <Txt variant="caption" color={Palette.textMuted}>
          Get a nudge when it&apos;s time for your next haircut.
        </Txt>
      </View>
      <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
    </Pressable>
  );
}

function Card({
  urgent,
  icon,
  title,
  subtitle,
  children,
}: {
  urgent: boolean;
  icon: 'scissors' | 'bell' | 'clock';
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      <View style={[styles.iconWrap, urgent && styles.iconWrapUrgent]}>
        <IconSymbol name={icon} size={20} color={urgent ? Palette.accent : Palette.textMuted} />
      </View>
      <View style={styles.body}>
        <Txt variant="label" color={Palette.text}>
          {title}
        </Txt>
        <Txt variant="caption" color={Palette.textMuted}>
          {subtitle}
        </Txt>
      </View>
      {children}
    </View>
  );
}

function Cta({ label, onPress, subtle }: { label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable style={[styles.cta, subtle && styles.ctaSubtle]} onPress={onPress} hitSlop={6}>
      <Txt variant="caption" color={subtle ? Palette.text : Palette.black} style={styles.ctaText}>
        {label}
      </Txt>
    </Pressable>
  );
}

function EditButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.editBtn} onPress={onPress} hitSlop={8}>
      <IconSymbol name="pencil" size={16} color={Palette.textMuted} />
    </Pressable>
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
  setPrompt: {},
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
  ctaSubtle: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  ctaText: { fontWeight: '700' },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
