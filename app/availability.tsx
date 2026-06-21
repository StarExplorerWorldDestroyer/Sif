import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchAvailability, fetchBookingSettings, saveAvailability, saveBookingSettings } from '@/lib/bookings';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import type { DepositType } from '@/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_OPTIONS = [15, 30, 45, 60, 90];
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];

// Selectable times: 6:00 AM → 10:00 PM in 30-minute steps.
const TIME_OPTIONS = Array.from({ length: (22 - 6) * 2 + 1 }, (_, i) => 360 + i * 30);

function timeLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

type DayState = { open: boolean; startMin: number; endMin: number };

export default function AvailabilityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const centered = useCenteredContent(640);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [acceptsBookings, setAcceptsBookings] = useState(true);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositType, setDepositType] = useState<DepositType>('percent');
  const [depositText, setDepositText] = useState('');
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [days, setDays] = useState<DayState[]>(
    DAYS.map(() => ({ open: false, startMin: 540, endMin: 1020 })),
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const uid = user?.id;
      if (!uid) return;
      const [settings, windows] = await Promise.all([
        fetchBookingSettings(uid),
        fetchAvailability(uid),
      ]);
      if (!active) return;
      setSlotMinutes(settings.slotMinutes);
      setAcceptsBookings(settings.acceptsBookings);
      setDepositEnabled(settings.depositEnabled);
      setDepositType(settings.depositType);
      setDepositText(settings.depositValue ? String(settings.depositValue) : '');
      setBufferBefore(settings.bufferBeforeMinutes);
      setBufferAfter(settings.bufferAfterMinutes);
      setDays((prev) =>
        prev.map((d, weekday) => {
          const w = windows.find((win) => win.weekday === weekday);
          return w ? { open: true, startMin: w.startMin, endMin: w.endMin } : d;
        }),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function save() {
    setSaving(true);
    const windows = days
      .map((d, weekday) => ({ weekday, startMin: d.startMin, endMin: d.endMin, open: d.open }))
      .filter((d) => d.open && d.endMin > d.startMin)
      .map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }));
    await Promise.all([
      saveAvailability(windows),
      saveBookingSettings({
        slotMinutes,
        acceptsBookings,
        depositEnabled,
        depositType,
        depositValue: Math.max(0, Number(depositText) || 0),
        bufferBeforeMinutes: bufferBefore,
        bufferAfterMinutes: bufferAfter,
      }),
    ]);
    setSaving(false);
    router.back();
  }

  function setDay(weekday: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === weekday ? { ...d, ...patch } : d)));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Availability</Txt>
        <Pressable onPress={save} hitSlop={8} disabled={saving || loading}>
          <Txt variant="label" color={saving || loading ? Palette.textDim : Palette.accent}>
            Save
          </Txt>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Txt variant="body">Accepting bookings</Txt>
                <Txt variant="caption">Turn off to hide your booking button.</Txt>
              </View>
              <Switch
                value={acceptsBookings}
                onValueChange={setAcceptsBookings}
                trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
                thumbColor={Palette.text}
              />
            </View>

            <View style={styles.divider} />

            <Txt variant="label" style={styles.rowLabel}>
              Default appointment length
            </Txt>
            <Txt variant="caption" color={Palette.textMuted} style={{ marginBottom: Spacing.sm }}>
              Used when you haven’t set up services.
            </Txt>
            <View style={styles.pillRow}>
              {SLOT_OPTIONS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setSlotMinutes(m)}
                  style={[styles.pill, m === slotMinutes && styles.pillActive]}>
                  <Txt variant="caption" color={m === slotMinutes ? Palette.black : Palette.textMuted}>
                    {m} min
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            style={styles.linkCard}
            onPress={() => router.push('/services')}
            accessibilityRole="button"
            accessibilityLabel="Manage services">
            <IconSymbol name="scissors" size={20} color={Palette.accent} />
            <View style={{ flex: 1 }}>
              <Txt variant="body">Services & pricing</Txt>
              <Txt variant="caption" color={Palette.textMuted}>
                Set what you offer, how long it takes, and the price.
              </Txt>
            </View>
            <IconSymbol name="chevron.right" size={20} color={Palette.textMuted} />
          </Pressable>

          <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
            DEPOSIT
          </Txt>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Txt variant="body">Require a deposit</Txt>
                <Txt variant="caption">When off, clients never see a deposit.</Txt>
              </View>
              <Switch
                value={depositEnabled}
                onValueChange={setDepositEnabled}
                trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
                thumbColor={Palette.text}
              />
            </View>

            {depositEnabled ? (
              <>
                <View style={styles.divider} />
                <Txt variant="label" style={styles.rowLabel}>
                  Deposit type
                </Txt>
                <View style={styles.pillRow}>
                  {(['percent', 'flat'] as DepositType[]).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setDepositType(t)}
                      style={[styles.pill, t === depositType && styles.pillActive]}>
                      <Txt variant="caption" color={t === depositType ? Palette.black : Palette.textMuted}>
                        {t === 'percent' ? 'Percentage' : 'Flat amount'}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
                <Txt variant="label" style={styles.rowLabel}>
                  {depositType === 'percent' ? 'Percent of service price' : 'Amount per booking'}
                </Txt>
                <View style={styles.depositInputRow}>
                  <TextInput
                    value={depositText}
                    onChangeText={setDepositText}
                    placeholder="0"
                    placeholderTextColor={Palette.textDim}
                    keyboardType="decimal-pad"
                    style={styles.depositInput}
                  />
                  <Txt variant="body" color={Palette.textMuted}>
                    {depositType === 'percent' ? '%' : 'per booking'}
                  </Txt>
                </View>
              </>
            ) : null}
          </View>

          <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
            DEFAULT BUFFERS
          </Txt>
          <View style={styles.card}>
            <Txt variant="caption" color={Palette.textMuted} style={{ marginBottom: Spacing.md }}>
              Padding around appointments so you’re never booked back-to-back. Services can override
              these.
            </Txt>
            <Txt variant="label" style={styles.rowLabel}>
              Before
            </Txt>
            <View style={styles.pillRow}>
              {BUFFER_OPTIONS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setBufferBefore(m)}
                  style={[styles.pill, m === bufferBefore && styles.pillActive]}>
                  <Txt variant="caption" color={m === bufferBefore ? Palette.black : Palette.textMuted}>
                    {m === 0 ? 'None' : `${m}m`}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <Txt variant="label" style={styles.rowLabel}>
              After
            </Txt>
            <View style={styles.pillRow}>
              {BUFFER_OPTIONS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setBufferAfter(m)}
                  style={[styles.pill, m === bufferAfter && styles.pillActive]}>
                  <Txt variant="caption" color={m === bufferAfter ? Palette.black : Palette.textMuted}>
                    {m === 0 ? 'None' : `${m}m`}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>

          <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
            WEEKLY HOURS
          </Txt>
          <View style={styles.card}>
            {days.map((d, weekday) => (
              <View key={weekday}>
                {weekday > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.dayRow}>
                  <Txt variant="body" style={styles.dayName}>
                    {DAYS[weekday]}
                  </Txt>
                  <Switch
                    value={d.open}
                    onValueChange={(v) => setDay(weekday, { open: v })}
                    trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
                    thumbColor={Palette.text}
                  />
                </View>
                {d.open ? (
                  <View style={styles.timeRow}>
                    <TimeField
                      value={d.startMin}
                      onChange={(v) => setDay(weekday, { startMin: v, endMin: Math.max(v + 30, d.endMin) })}
                    />
                    <Txt variant="label" color={Palette.textMuted}>
                      to
                    </Txt>
                    <TimeField
                      value={d.endMin}
                      min={d.startMin + 30}
                      onChange={(v) => setDay(weekday, { endMin: v })}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TimeField({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => TIME_OPTIONS.filter((t) => (min === undefined ? true : t >= min)),
    [min],
  );
  return (
    <>
      <Pressable style={styles.timeField} onPress={() => setOpen(true)}>
        <Txt variant="label" color={Palette.text}>
          {timeLabel(value)}
        </Txt>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView>
              {options.map((t) => (
                <Pressable
                  key={t}
                  style={styles.timeOption}
                  onPress={() => {
                    onChange(t);
                    setOpen(false);
                  }}>
                  <Txt variant="body" color={t === value ? Palette.accent : Palette.text}>
                    {timeLabel(t)}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  sectionTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm, letterSpacing: 1 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  depositInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  depositInput: {
    flex: 1,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Palette.text,
    fontSize: 16,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowLabel: { marginBottom: Spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  pillActive: { backgroundColor: Palette.accent },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border, marginVertical: Spacing.md },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { flex: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  timeField: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
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
    maxWidth: 320,
    maxHeight: '70%',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingVertical: Spacing.sm,
  },
  timeOption: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center' },
});
