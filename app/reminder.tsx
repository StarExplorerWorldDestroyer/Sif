import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import {
  REMINDER_ORDINALS,
  REMINDER_WEEKDAYS,
  addUnit,
  describeRule,
  formatReminderDate,
  nextReminderDate,
  relativeDays,
  toISODate,
} from '@/lib/reminders';
import { useProfile } from '@/store/profile';
import type { ReminderOrdinal, ReminderRule, ReminderUnit } from '@/types';

type Mode = 'interval' | 'monthly' | 'once';

const UNITS: { value: ReminderUnit; label: string }[] = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];

const QUICK: { label: string; every: number; unit: ReminderUnit }[] = [
  { label: '2 weeks', every: 2, unit: 'week' },
  { label: '4 weeks', every: 4, unit: 'week' },
  { label: '6 weeks', every: 6, unit: 'week' },
  { label: '2 months', every: 2, unit: 'month' },
  { label: '3 months', every: 3, unit: 'month' },
];

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Txt variant="label" color={active ? Palette.black : Palette.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

export default function ReminderScreen() {
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const centered = useCenteredContent(640);
  const { postcut, from } = useLocalSearchParams<{ postcut?: string; from?: string }>();
  const isPostCut = postcut === '1';

  const baseDate = useMemo(() => (from ? new Date(from) : new Date()), [from]);
  const existing = profile?.cutReminder?.rule;

  const [mode, setMode] = useState<Mode>(
    existing?.kind === 'nth_weekday' ? 'monthly' : existing?.kind === 'one_off' ? 'once' : 'interval',
  );
  const [every, setEvery] = useState(
    existing?.kind === 'interval' ? String(existing.every) : '4',
  );
  const [unit, setUnit] = useState<ReminderUnit>(
    existing?.kind === 'interval' ? existing.unit : 'week',
  );
  const [ordinal, setOrdinal] = useState<ReminderOrdinal>(
    existing?.kind === 'nth_weekday' ? existing.ordinal : 1,
  );
  const [weekday, setWeekday] = useState<number>(
    existing?.kind === 'nth_weekday' ? existing.weekday : 6,
  );
  const [anchor, setAnchor] = useState(
    existing?.kind === 'interval'
      ? existing.anchor
      : toISODate(addUnit(baseDate, 4, 'week')),
  );
  const [onceDate, setOnceDate] = useState(
    existing?.kind === 'one_off' ? existing.date : toISODate(addUnit(baseDate, 4, 'week')),
  );
  const [saving, setSaving] = useState(false);

  const rule: ReminderRule = useMemo(() => {
    if (mode === 'monthly') return { kind: 'nth_weekday', ordinal, weekday };
    if (mode === 'once') return { kind: 'one_off', date: onceDate };
    return { kind: 'interval', every: Math.max(1, Number(every) || 1), unit, anchor };
  }, [mode, ordinal, weekday, onceDate, every, unit, anchor]);

  const preview = useMemo(() => nextReminderDate(rule), [rule]);

  function applyQuick(q: { every: number; unit: ReminderUnit }) {
    setMode('interval');
    setEvery(String(q.every));
    setUnit(q.unit);
    setAnchor(toISODate(addUnit(baseDate, q.every, q.unit)));
  }

  async function save() {
    setSaving(true);
    const { error } = await updateProfile({
      cutReminder: { rule, createdAt: new Date().toISOString() },
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save reminder', error);
      return;
    }
    router.back();
  }

  async function remove() {
    setSaving(true);
    await updateProfile({ cutReminder: null });
    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt variant="body" color={Palette.textMuted}>
            {isPostCut ? 'Skip' : 'Cancel'}
          </Txt>
        </Pressable>
        <Txt variant="heading">{isPostCut ? 'Next cut?' : 'Cut reminder'}</Txt>
        <Pressable onPress={save} hitSlop={8} disabled={saving || !preview}>
          <Txt variant="body" color={preview && !saving ? Palette.accent : Palette.textDim}>
            Save
          </Txt>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, centered]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {isPostCut ? (
          <Txt variant="body" color={Palette.textMuted} style={styles.intro}>
            Nice cut. Want a reminder when it&apos;s time for the next one?
          </Txt>
        ) : null}

        <Txt variant="label" style={styles.sectionLabel}>
          Quick pick
        </Txt>
        <View style={styles.wrapRow}>
          {QUICK.map((q) => (
            <Pill
              key={q.label}
              label={q.label}
              active={
                mode === 'interval' && Number(every) === q.every && unit === q.unit
              }
              onPress={() => applyQuick(q)}
            />
          ))}
        </View>

        <Txt variant="label" style={styles.sectionLabel}>
          Or customize
        </Txt>
        <View style={styles.segment}>
          <Pill label="Every" active={mode === 'interval'} onPress={() => setMode('interval')} />
          <Pill label="Monthly" active={mode === 'monthly'} onPress={() => setMode('monthly')} />
          <Pill label="Once" active={mode === 'once'} onPress={() => setMode('once')} />
        </View>

        {mode === 'interval' ? (
          <View style={styles.section}>
            <Txt variant="caption">Repeat every</Txt>
            <View style={styles.stepperRow}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setEvery((v) => String(Math.max(1, (Number(v) || 1) - 1)))}>
                <IconSymbol name="minus" size={14} color={Palette.text} />
              </Pressable>
              <Txt variant="heading" style={styles.stepValue}>
                {Math.max(1, Number(every) || 1)}
              </Txt>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setEvery((v) => String((Number(v) || 1) + 1))}>
                <IconSymbol name="plus" size={14} color={Palette.text} />
              </Pressable>
              <View style={styles.unitRow}>
                {UNITS.map((u) => (
                  <Pill
                    key={u.value}
                    label={u.label}
                    active={unit === u.value}
                    onPress={() => setUnit(u.value)}
                  />
                ))}
              </View>
            </View>
            <Field
              label="Starting on"
              placeholder="YYYY-MM-DD"
              value={anchor}
              onChangeText={setAnchor}
              autoCapitalize="none"
            />
          </View>
        ) : null}

        {mode === 'monthly' ? (
          <View style={styles.section}>
            <Txt variant="caption">Which week</Txt>
            <View style={styles.wrapRow}>
              {REMINDER_ORDINALS.map((o) => (
                <Pill
                  key={o.value}
                  label={o.label}
                  active={ordinal === o.value}
                  onPress={() => setOrdinal(o.value)}
                />
              ))}
            </View>
            <Txt variant="caption" style={{ marginTop: Spacing.sm }}>
              Which day
            </Txt>
            <View style={styles.wrapRow}>
              {REMINDER_WEEKDAYS.map((d, i) => (
                <Pill
                  key={d}
                  label={d}
                  active={weekday === i}
                  onPress={() => setWeekday(i)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {mode === 'once' ? (
          <View style={styles.section}>
            <Field
              label="Remind me on"
              placeholder="YYYY-MM-DD"
              value={onceDate}
              onChangeText={setOnceDate}
              autoCapitalize="none"
            />
          </View>
        ) : null}

        <View style={styles.preview}>
          <IconSymbol name="bell" size={18} color={Palette.accent} />
          <View style={{ flex: 1 }}>
            <Txt variant="label" color={Palette.text}>
              {describeRule(rule)}
            </Txt>
            <Txt variant="caption" color={Palette.textMuted}>
              {preview
                ? `Next reminder ${formatReminderDate(preview)} · ${relativeDays(
                    Math.round((preview.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000),
                  )}`
                : 'That date has already passed — pick a future date.'}
            </Txt>
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, (!preview || saving) && styles.disabled]}
          onPress={save}
          disabled={!preview || saving}>
          <Txt variant="body" color={Palette.black} style={styles.saveText}>
            {existing ? 'Update reminder' : 'Set reminder'}
          </Txt>
        </Pressable>

        {existing ? (
          <Pressable style={styles.removeButton} onPress={remove} disabled={saving}>
            <Txt variant="label" color={Palette.textMuted}>
              Remove reminder
            </Txt>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  intro: { marginBottom: Spacing.lg },
  sectionLabel: { marginBottom: Spacing.sm, marginTop: Spacing.sm },
  section: { gap: Spacing.sm, marginTop: Spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  pillActive: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 28, textAlign: 'center' },
  unitRow: { flexDirection: 'row', gap: Spacing.sm },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },
  saveButton: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  saveText: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
  removeButton: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
});
