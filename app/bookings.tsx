import { AppImage as Image } from '@/components/ui/app-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StarPicker, StarRating } from '@/components/ui/stars';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { cancelBooking, fetchMyBookings, updateBookingStatus } from '@/lib/bookings';
import { getOrCreateConversation } from '@/lib/messages';
import { fetchMyReviewsByBooking, submitReview } from '@/lib/reviews';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useRefresh } from '@/hooks/use-refresh';
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
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [reviews, setReviews] = useState<Map<string, { rating: number; body: string }>>(new Map());
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async () => {
    const [bs, rv] = await Promise.all([fetchMyBookings(), fetchMyReviewsByBooking()]);
    setBookings(bs);
    setReviews(rv);
    setLoading(false);
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

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

  const reschedule = useCallback(
    (b: Booking) => router.push(`/book/${b.stylistId}?reschedule=${b.id}`),
    [router],
  );

  const message = useCallback(
    async (b: Booking) => {
      const cid = await getOrCreateConversation(b.other.id);
      if (cid) router.push(`/messages/${cid}?other=${b.other.id}`);
    },
    [router],
  );

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    const reason = cancelReasonText;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'cancelled', cancelReason: reason.trim() } : b)),
    );
    setCancelTarget(null);
    setCancelReasonText('');
    await cancelBooking(id, reason);
    load();
  }, [cancelTarget, cancelReasonText, load]);

  const openReview = useCallback(
    (b: Booking) => {
      const existing = reviews.get(b.id);
      setReviewRating(existing?.rating ?? 5);
      setReviewBody(existing?.body ?? '');
      setReviewTarget(b);
    },
    [reviews],
  );

  const submitReviewForTarget = useCallback(async () => {
    if (!reviewTarget) return;
    setSavingReview(true);
    const { error } = await submitReview({
      bookingId: reviewTarget.id,
      stylistId: reviewTarget.stylistId,
      rating: reviewRating,
      body: reviewBody,
    });
    setSavingReview(false);
    if (error) return;
    setReviews((prev) => {
      const next = new Map(prev);
      next.set(reviewTarget.id, { rating: reviewRating, body: reviewBody.trim() });
      return next;
    });
    setReviewTarget(null);
    setReviewBody('');
  }, [reviewTarget, reviewRating, reviewBody]);

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
      <ScreenHeader title="Bookings" />

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
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />
          }>
          {requests.length > 0 ? (
            <Section title="Requests">
              {requests.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  reviewedRating={reviews.get(b.id)?.rating ?? null}
                  onAct={act}
                  onCreateCut={createCut}
                  onReschedule={reschedule}
                  onCancel={setCancelTarget}
                  onReview={openReview}
                  onMessage={message}
                />
              ))}
            </Section>
          ) : null}
          {upcoming.length > 0 ? (
            <Section title="Upcoming">
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  reviewedRating={reviews.get(b.id)?.rating ?? null}
                  onAct={act}
                  onCreateCut={createCut}
                  onReschedule={reschedule}
                  onCancel={setCancelTarget}
                  onReview={openReview}
                  onMessage={message}
                />
              ))}
            </Section>
          ) : null}
          {past.length > 0 ? (
            <Section title="Past & closed">
              {past.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  reviewedRating={reviews.get(b.id)?.rating ?? null}
                  onAct={act}
                  onCreateCut={createCut}
                  onReschedule={reschedule}
                  onCancel={setCancelTarget}
                  onReview={openReview}
                  onMessage={message}
                />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={!!cancelTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCancelTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Txt variant="heading">Cancel booking?</Txt>
            <Txt variant="label" color={Palette.textMuted} style={{ marginTop: Spacing.xs }}>
              {cancelTarget
                ? `With ${cancelTarget.other.displayName || (cancelTarget.other.username ? `@${cancelTarget.other.username}` : 'this person')}. Add an optional reason they'll see.`
                : ''}
            </Txt>
            <TextInput
              value={cancelReasonText}
              onChangeText={setCancelReasonText}
              placeholder="Reason (optional)"
              placeholderTextColor={Palette.textDim}
              style={styles.reasonInput}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setCancelTarget(null)}>
                <Txt variant="label" color={Palette.text}>
                  Keep it
                </Txt>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={confirmCancel}>
                <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                  Cancel booking
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!reviewTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReviewTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Txt variant="heading">Rate your appointment</Txt>
            <Txt variant="label" color={Palette.textMuted} style={{ marginTop: Spacing.xs }}>
              {reviewTarget
                ? `How was your cut with ${reviewTarget.other.displayName || (reviewTarget.other.username ? `@${reviewTarget.other.username}` : 'this stylist')}?`
                : ''}
            </Txt>
            <View style={styles.starsRow}>
              <StarPicker value={reviewRating} onChange={setReviewRating} />
            </View>
            <TextInput
              value={reviewBody}
              onChangeText={setReviewBody}
              placeholder="Share a few words (optional)"
              placeholderTextColor={Palette.textDim}
              style={styles.reasonInput}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setReviewTarget(null)}>
                <Txt variant="label" color={Palette.text}>
                  Cancel
                </Txt>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, savingReview && { opacity: 0.6 }]}
                disabled={savingReview}
                onPress={submitReviewForTarget}>
                <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                  {savingReview ? 'Saving…' : 'Submit review'}
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  reviewedRating,
  onAct,
  onCreateCut,
  onReschedule,
  onCancel,
  onReview,
  onMessage,
}: {
  booking: Booking;
  reviewedRating: number | null;
  onAct: (id: string, status: BookingStatus) => void;
  onCreateCut: (booking: Booking) => void;
  onReschedule: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  onReview: (booking: Booking) => void;
  onMessage: (booking: Booking) => void;
}) {
  const { other, role, status } = booking;
  const name = other.displayName || (other.username ? `@${other.username}` : 'Sif user');
  const isFuture = new Date(booking.startsAt).getTime() >= Date.now();
  const active = status === 'pending' || status === 'confirmed';
  const canRespond = role === 'stylist' && status === 'pending';
  const canComplete = role === 'stylist' && status === 'confirmed' && !isFuture;
  const canCreateCut = role === 'stylist' && (status === 'confirmed' || status === 'completed');
  // Clients can reschedule/cancel their active future bookings; stylists can
  // cancel a confirmed future booking (they decline while it's still pending).
  const canReschedule = role === 'client' && active && isFuture;
  const canCancel =
    isFuture && ((role === 'client' && active) || (role === 'stylist' && status === 'confirmed'));
  // Clients can review a completed appointment (and edit it afterwards).
  const canReview = role === 'client' && status === 'completed';

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

      {status === 'cancelled' && booking.cancelReason ? (
        <Txt variant="caption" color={Palette.textMuted} style={styles.note}>
          Reason: {booking.cancelReason}
        </Txt>
      ) : null}

      {canReview && reviewedRating ? (
        <View style={styles.reviewedRow}>
          <StarRating value={reviewedRating} size={14} />
          <Txt variant="caption" color={Palette.textMuted}>
            Your rating
          </Txt>
        </View>
      ) : null}

      <View style={styles.actions}>
          <Pressable style={styles.btn} onPress={() => onMessage(booking)}>
            <Txt variant="label" color={Palette.text}>
              Message
            </Txt>
          </Pressable>
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
          {canReschedule ? (
            <Pressable style={styles.btn} onPress={() => onReschedule(booking)}>
              <Txt variant="label" color={Palette.text}>
                Reschedule
              </Txt>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable style={styles.btn} onPress={() => onCancel(booking)}>
              <Txt variant="label" color={Palette.text}>
                Cancel
              </Txt>
            </Pressable>
          ) : null}
          {canReview ? (
            <Pressable style={styles.btn} onPress={() => onReview(booking)}>
              <Txt variant="label" color={Palette.text}>
                {reviewedRating ? 'Edit review' : 'Leave a review'}
              </Txt>
            </Pressable>
          ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
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
  reviewedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  starsRow: { alignItems: 'center', marginTop: Spacing.lg },
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
  btnDanger: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  reasonInput: {
    color: Palette.text,
    fontSize: 15,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: Spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, justifyContent: 'flex-end' },
});
