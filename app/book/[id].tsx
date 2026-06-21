import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DatePickerField } from '@/components/ui/date-picker-field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import {
  computeDaySlots,
  computeDeposit,
  createBooking,
  fetchAvailability,
  fetchBookingSettings,
  fetchBusyIntervals,
  fetchStylistCard,
  rescheduleBooking,
} from '@/lib/bookings';
import { fetchServices } from '@/lib/services';
import { toISODate } from '@/lib/reminders';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';
import type {
  AvailabilityWindow,
  BookingSlot,
  BookingSettings,
  StylistCard,
  StylistService,
} from '@/types';

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

export default function BookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useFeedback();
  const money = useMoney();
  const { id, reschedule } = useLocalSearchParams<{ id: string; reschedule?: string }>();
  const isReschedule = !!reschedule;
  const centered = useCenteredContent(560);

  const [stylist, setStylist] = useState<StylistCard | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [services, setServices] = useState<StylistService[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateISO, setDateISO] = useState(() => toISODate(new Date()));
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [card, s, w, svc] = await Promise.all([
        fetchStylistCard(id),
        fetchBookingSettings(id),
        fetchAvailability(id),
        fetchServices(id, true),
      ]);
      if (active) {
        setStylist(card);
        setSettings(s);
        setWindows(w);
        setServices(svc);
        if (!isReschedule && svc.length > 0) setServiceId(svc[0].id);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isReschedule]);

  const activeService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  // Effective timing/pricing: service overrides settings defaults.
  const duration = activeService?.durationMinutes ?? settings?.slotMinutes ?? 60;
  const bufferBefore = activeService?.bufferBeforeMinutes ?? settings?.bufferBeforeMinutes ?? 0;
  const bufferAfter = activeService?.bufferAfterMinutes ?? settings?.bufferAfterMinutes ?? 0;
  const price = activeService?.price ?? 0;
  const deposit = settings ? computeDeposit(settings, price) : 0;

  const loadSlots = useCallback(async () => {
    if (!settings) return;
    setSlotsLoading(true);
    setSelected(null);
    const busy = await fetchBusyIntervals(id, dateISO);
    setSlots(
      computeDaySlots({
        windows,
        dateISO,
        durationMinutes: duration,
        bufferBeforeMinutes: bufferBefore,
        bufferAfterMinutes: bufferAfter,
        busy,
      }),
    );
    setSlotsLoading(false);
  }, [id, dateISO, windows, settings, duration, bufferBefore, bufferAfter]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const submit = useCallback(async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!selected || !settings || submitting) return;
    setSubmitting(true);

    if (isReschedule && reschedule) {
      const { error } = await rescheduleBooking(reschedule, selected);
      setSubmitting(false);
      if (!error) {
        router.replace('/bookings');
        toast('Your appointment was rescheduled and sent for confirmation.', { tone: 'success' });
      } else {
        toast(error, { tone: 'error' });
        loadSlots();
      }
      return;
    }

    const { id: bookingId, error } = await createBooking({
      stylistId: id,
      startsAtISO: selected,
      durationMinutes: duration,
      note,
      serviceId: activeService?.id ?? null,
      price,
      depositAmount: deposit,
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
    });
    setSubmitting(false);
    if (bookingId) {
      if (deposit > 0) {
        router.replace(`/pay/${bookingId}?kind=deposit&new=1`);
      } else {
        router.replace('/bookings');
        toast('Your booking request was sent. You’ll be notified when it’s confirmed.', {
          tone: 'success',
        });
      }
    } else {
      toast(error ?? 'Something went wrong.', { tone: 'error' });
      loadSlots();
    }
  }, [
    user,
    router,
    selected,
    settings,
    submitting,
    id,
    note,
    loadSlots,
    isReschedule,
    reschedule,
    toast,
    duration,
    activeService,
    price,
    deposit,
    bufferBefore,
    bufferAfter,
  ]);

  const name = stylist?.displayName || stylist?.username || 'this stylist';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">{isReschedule ? 'Reschedule' : 'Book'}</Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : !settings?.acceptsBookings ? (
        <View style={styles.center}>
          <IconSymbol name="calendar" size={32} color={Palette.textDim} />
          <Txt variant="label" color={Palette.textMuted} style={styles.muted}>
            {name} isn’t accepting bookings right now.
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} keyboardShouldPersistTaps="handled">
          <Txt variant="body" style={styles.lead}>
            {isReschedule ? 'Pick a new time with ' : 'Request a time with '}
            <Txt variant="label" color={Palette.accent}>{name}</Txt>. They’ll confirm or decline.
          </Txt>

          {!isReschedule && services.length > 0 ? (
            <>
              <Txt variant="label" style={styles.sectionLabel}>
                Service
              </Txt>
              <View style={styles.serviceList}>
                {services.map((s) => {
                  const isSel = s.id === serviceId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setServiceId(s.id)}
                      style={[styles.serviceRow, isSel && styles.serviceRowActive]}
                      accessibilityRole="button">
                      <View style={[styles.radio, isSel && styles.radioActive]}>
                        {isSel ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt variant="body" numberOfLines={1}>
                          {s.name}
                        </Txt>
                        <Txt variant="caption" color={Palette.textMuted}>
                          {durationLabel(s.durationMinutes)}
                          {s.description ? ` · ${s.description}` : ''}
                        </Txt>
                      </View>
                      <Txt variant="body" mono color={isSel ? Palette.accent : Palette.text}>
                        {money(s.price)}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <DatePickerField
            label="Date"
            value={dateISO}
            onChange={setDateISO}
            minimumDate={toISODate(new Date())}
          />

          <Txt variant="label" style={styles.sectionLabel}>
            Available times
          </Txt>
          {slotsLoading ? (
            <View style={styles.slotsLoading}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : slots.length === 0 ? (
            <Txt variant="caption" style={styles.muted}>
              No times available on this day. Try another date.
            </Txt>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map((slot) => {
                const isSelected = selected === slot.iso;
                return (
                  <Pressable
                    key={slot.iso}
                    disabled={slot.taken}
                    onPress={() => setSelected(slot.iso)}
                    style={[
                      styles.slot,
                      slot.taken && styles.slotTaken,
                      isSelected && styles.slotSelected,
                    ]}>
                    <Txt
                      variant="label"
                      color={
                        slot.taken ? Palette.textDim : isSelected ? Palette.black : Palette.text
                      }>
                      {slot.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isReschedule ? null : (
            <>
              <Txt variant="label" style={styles.sectionLabel}>
                Note (optional)
              </Txt>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What are you looking for? Any references?"
                placeholderTextColor={Palette.textDim}
                style={styles.input}
                multiline
              />
            </>
          )}

          {!isReschedule && price > 0 ? (
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Txt variant="label" color={Palette.textMuted}>
                  {activeService?.name ?? 'Service'}
                </Txt>
                <Txt variant="label" mono>
                  {money(price)}
                </Txt>
              </View>
              {deposit > 0 ? (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Txt variant="label" color={Palette.accent}>
                      Deposit due now
                    </Txt>
                    <Txt variant="label" mono color={Palette.accent}>
                      {money(deposit)}
                    </Txt>
                  </View>
                  <View style={styles.summaryRow}>
                    <Txt variant="caption" color={Palette.textMuted}>
                      Balance at appointment
                    </Txt>
                    <Txt variant="caption" color={Palette.textMuted}>
                      {money(Math.max(0, price - deposit))}
                    </Txt>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[styles.submit, (!selected || submitting) && styles.submitDisabled]}
            disabled={!selected || submitting}
            onPress={submit}
            accessibilityRole="button">
            {submitting ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="label" color={Palette.black} style={{ fontWeight: '700' }}>
                {isReschedule
                  ? 'Reschedule'
                  : deposit > 0
                    ? `Continue · ${money(deposit)} deposit`
                    : 'Request booking'}
              </Txt>
            )}
          </Pressable>
        </ScrollView>
      )}
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
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  muted: { textAlign: 'center', color: Palette.textMuted },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  lead: { marginBottom: Spacing.lg, lineHeight: 22 },
  sectionLabel: { marginBottom: Spacing.sm, marginTop: Spacing.xs },
  serviceList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  serviceRowActive: { borderColor: Palette.accent },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Palette.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: Palette.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.accent },
  slotsLoading: { paddingVertical: Spacing.lg, alignItems: 'center' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  slot: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  slotTaken: { opacity: 0.4 },
  slotSelected: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  input: {
    color: Palette.text,
    fontSize: 15,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  summary: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border, marginVertical: Spacing.xs },
  submit: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Glow.md,
  },
  submitDisabled: { opacity: 0.5 },
});
