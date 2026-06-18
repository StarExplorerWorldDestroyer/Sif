import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Palette, Radius, Spacing } from '@/constants/theme';
import {
  computeDaySlots,
  createBooking,
  fetchAvailability,
  fetchBookingSettings,
  fetchStylistCard,
  fetchTakenSlots,
} from '@/lib/bookings';
import { toISODate } from '@/lib/reminders';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import type { AvailabilityWindow, BookingSlot, BookingSettings, StylistCard } from '@/types';

export default function BookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const centered = useCenteredContent(560);

  const [stylist, setStylist] = useState<StylistCard | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
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
      const [card, s, w] = await Promise.all([
        fetchStylistCard(id),
        fetchBookingSettings(id),
        fetchAvailability(id),
      ]);
      if (active) {
        setStylist(card);
        setSettings(s);
        setWindows(w);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const loadSlots = useCallback(async () => {
    if (!settings) return;
    setSlotsLoading(true);
    setSelected(null);
    const taken = await fetchTakenSlots(id, dateISO);
    setSlots(
      computeDaySlots({ windows, dateISO, slotMinutes: settings.slotMinutes, takenEpochs: taken }),
    );
    setSlotsLoading(false);
  }, [id, dateISO, windows, settings]);

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
    const { id: bookingId, error } = await createBooking(
      id,
      selected,
      settings.slotMinutes,
      note,
    );
    setSubmitting(false);
    if (bookingId) {
      Alert.alert('Request sent', 'Your booking request was sent. You’ll be notified when it’s confirmed.');
      router.replace('/bookings');
    } else {
      Alert.alert('Could not book', error ?? 'Something went wrong.');
      loadSlots();
    }
  }, [user, router, selected, settings, submitting, id, note, loadSlots]);

  const name = stylist?.displayName || stylist?.username || 'this stylist';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Book</Txt>
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
            Request a time with <Txt variant="label" color={Palette.accent}>{name}</Txt>. They’ll
            confirm or decline.
          </Txt>

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

          <Pressable
            style={[styles.submit, (!selected || submitting) && styles.submitDisabled]}
            disabled={!selected || submitting}
            onPress={submit}>
            {submitting ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                Request booking
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
  submit: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
});
