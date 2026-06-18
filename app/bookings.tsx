import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchMyBookings, updateBookingStatus } from '@/lib/bookings';
import { useCenteredContent } from '@/hooks/use-responsive';
import type { Booking, BookingStatus } from '@/types';

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: Palette.textMuted,
  confirmed: Palette.success,
  declined: Palette.textDim,
  cancelled: Palette.textDim,
  completed: Palette.accent,
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function BookingsScreen() {
  const router = useRouter();
  const centered = useCenteredContent(640);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setBookings(await fetchMyBookings());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = useCallback(
    async (id: string, status: BookingStatus) => {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      await updateBookingStatus(id, status);
      load();
    },
    [load],
  );

  const createCut = useCallback(
    (b: Booking) => {
      const name = b.other.username ?? b.other.displayName;
      router.push(`/add?clientId=${b.clientId}&clientName=${encodeURIComponent(name)}`);
    },
    [router],
  );

  const now = Date.now();
  const requests = bookings.filter((b) => b.role === 'stylist' && b.status === 'pending');
  const upcoming = bookings.filter(
    (b) =>
      (b.status === 'confirmed' || (b.role === 'client' && b.status === 'pending')) &&
      new Date(b.startsAt).getTime() >= now,
  );
  const past = bookings.filter(
    (b) => !requests.includes(b) && !upcoming.includes(b),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Bookings</Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings yet"
          subtitle="Find a stylist in Discover and request a time. Your appointments show up here."
          primaryLabel="Find a stylist"
          onPrimary={() => router.replace('/(tabs)/discover')}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
          {requests.length > 0 ? (
            <Section title="Requests">
              {requests.map((b) => (
                <BookingCard key={b.id} booking={b} onAct={act} onCreateCut={createCut} />
              ))}
            </Section>
          ) : null}
          {upcoming.length > 0 ? (
            <Section title="Upcoming">
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} onAct={act} onCreateCut={createCut} />
              ))}
            </Section>
          ) : null}
          {past.length > 0 ? (
            <Section title="Past & closed">
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} onAct={act} onCreateCut={createCut} />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Txt>
      {children}
    </View>
  );
}

function BookingCard({
  booking,
  onAct,
  onCreateCut,
}: {
  booking: Booking;
  onAct: (id: string, status: BookingStatus) => void;
  onCreateCut: (booking: Booking) => void;
}) {
  const { other, role, status } = booking;
  const name = other.displayName || (other.username ? `@${other.username}` : 'Sif user');
  const isFuture = new Date(booking.startsAt).getTime() >= Date.now();
  const canCancel = role === 'client' && (status === 'pending' || status === 'confirmed') && isFuture;
  const canRespond = role === 'stylist' && status === 'pending';
  const canComplete = role === 'stylist' && status === 'confirmed' && !isFuture;
  const canCreateCut = role === 'stylist' && (status === 'confirmed' || status === 'completed');

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {other.avatarUrl ? (
          <Image source={{ uri: other.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Txt variant="body" numberOfLines={1}>
            {name}
          </Txt>
          <Txt variant="caption" color={Palette.textMuted}>
            {role === 'stylist' ? 'Client' : 'Stylist'} · {formatWhen(booking.startsAt)}
          </Txt>
        </View>
        <Txt variant="caption" color={STATUS_COLOR[status]} style={styles.status}>
          {status}
        </Txt>
      </View>

      {booking.note ? (
        <Txt variant="label" color={Palette.textMuted} style={styles.note}>
          “{booking.note}”
        </Txt>
      ) : null}

      {canRespond || canCancel || canComplete || canCreateCut ? (
        <View style={styles.actions}>
          {canRespond ? (
            <>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => onAct(booking.id, 'confirmed')}>
                <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                  Confirm
                </Txt>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => onAct(booking.id, 'declined')}>
                <Txt variant="label" color={Palette.text}>
                  Decline
                </Txt>
              </Pressable>
            </>
          ) : null}
          {canComplete ? (
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => onAct(booking.id, 'completed')}>
              <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                Mark done
              </Txt>
            </Pressable>
          ) : null}
          {canCreateCut ? (
            <Pressable style={styles.btn} onPress={() => onCreateCut(booking)}>
              <Txt variant="label" color={Palette.text}>
                Create the cut
              </Txt>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable style={styles.btn} onPress={() => onAct(booking.id, 'cancelled')}>
              <Txt variant="label" color={Palette.text}>
                Cancel
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { marginBottom: Spacing.sm, letterSpacing: 1 },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  status: { textTransform: 'capitalize' },
  note: { marginTop: Spacing.sm, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceAlt,
  },
  btnPrimary: { backgroundColor: Palette.accent, borderColor: Palette.accent },
});
