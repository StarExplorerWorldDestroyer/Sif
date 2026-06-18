import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatReminderDate, toISODate } from '@/lib/reminders';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseLocal(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * A labeled field that opens a themed month calendar to pick a date. Works on
 * web and native (plain RN Modal + Views), and reads/writes local `yyyy-mm-dd`
 * so the chosen day never shifts across timezones.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  /** Optional ISO date; earlier days are shown disabled. */
  minimumDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseLocal(value), [value]);
  const min = useMemo(() => parseLocal(minimumDate), [minimumDate]);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const today = startOfDay(new Date());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function pick(day: number) {
    onChange(toISODate(new Date(year, month, day)));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setViewMonth(new Date(year, month + delta, 1));
  }

  return (
    <View style={styles.wrap}>
      <Txt variant="label" style={styles.label}>
        {label}
      </Txt>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Txt variant="body" color={selected ? Palette.text : Palette.textDim}>
          {selected ? formatReminderDate(selected) : 'Pick a date'}
        </Txt>
        <IconSymbol name="calendar" size={18} color={Palette.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.calHeader}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.navBtn}>
                <IconSymbol name="chevron.left" size={20} color={Palette.text} />
              </Pressable>
              <Txt variant="heading">
                {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Txt>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={styles.navBtn}>
                <IconSymbol name="chevron.right" size={20} color={Palette.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAY_LETTERS.map((d, i) => (
                <View key={i} style={styles.headerCell}>
                  <Txt variant="caption" color={Palette.textDim}>
                    {d}
                  </Txt>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={`b${i}`} style={styles.cell} />;
                const date = new Date(year, month, day);
                const disabled = !!min && date < min;
                const isSelected = !!selected && sameDay(date, selected);
                const isToday = sameDay(date, today);
                return (
                  <Pressable
                    key={day}
                    style={styles.cell}
                    disabled={disabled}
                    onPress={() => pick(day)}>
                    <View style={[styles.day, isSelected && styles.daySelected]}>
                      <Txt
                        variant="label"
                        color={
                          disabled
                            ? Palette.textDim
                            : isSelected
                              ? Palette.black
                              : isToday
                                ? Palette.accent
                                : Palette.text
                        }>
                        {day}
                      </Txt>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.todayBtn}
              onPress={() => {
                onChange(toISODate(today));
                setOpen(false);
              }}>
              <Txt variant="label" color={Palette.accent}>
                Today
              </Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CELL = `${100 / 7}%`;

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  headerCell: {
    width: CELL as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  cell: {
    width: CELL as unknown as number,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: Palette.accent },
  todayBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
});
