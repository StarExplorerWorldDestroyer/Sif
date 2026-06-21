import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { PAYMENTS_PROVIDER } from '@/constants/payments';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import { fetchBooking } from '@/lib/bookings';
import { amountDueFor, payForBooking } from '@/lib/payments';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useFeedback } from '@/store/feedback';
import { useProfile } from '@/store/profile';
import type { Booking, PaymentKind } from '@/types';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { toast } = useFeedback();
  const money = useMoney();
  const { profile } = useProfile();
  const centered = useCenteredContent(480);
  const { id, kind, new: isNew } = useLocalSearchParams<{
    id: string;
    kind?: string;
    new?: string;
  }>();
  const payKind: PaymentKind = kind === 'balance' ? 'balance' : kind === 'full' ? 'full' : 'deposit';

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [exp, setExp] = useState('12 / 34');
  const [cvc, setCvc] = useState('123');

  useEffect(() => {
    let active = true;
    (async () => {
      const b = await fetchBooking(id);
      if (active) {
        setBooking(b);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const due = booking ? amountDueFor(booking, payKind) : 0;

  const pay = useCallback(async () => {
    if (!booking || paying) return;
    setPaying(true);
    const { ok, error } = await payForBooking({
      booking,
      kind: payKind,
      currency: profile?.currency ?? 'USD',
    });
    setPaying(false);
    if (ok) {
      router.replace('/bookings');
      toast(
        payKind === 'deposit'
          ? 'Deposit paid — your request is on its way.'
          : 'Payment complete. Thank you!',
        { tone: 'success' },
      );
    } else {
      toast(error ?? 'Payment failed.', { tone: 'error' });
    }
  }, [booking, paying, payKind, profile?.currency, router, toast]);

  const title = payKind === 'deposit' ? 'Pay deposit' : payKind === 'balance' ? 'Pay balance' : 'Pay';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">{title}</Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : !booking || due <= 0 ? (
        <View style={styles.center}>
          <IconSymbol name="checkmark.seal.fill" size={32} color={Palette.success} />
          <Txt variant="label" color={Palette.textMuted} style={{ textAlign: 'center' }}>
            {booking ? 'Nothing left to pay on this booking.' : 'Booking not found.'}
          </Txt>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/bookings')}>
            <Txt variant="label" color={Palette.text}>
              Back to bookings
            </Txt>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} keyboardShouldPersistTaps="handled">
          {isNew ? (
            <Txt variant="body" color={Palette.textMuted} style={styles.lead}>
              Almost there — secure your appointment with a deposit. The rest is due at your visit.
            </Txt>
          ) : null}

          <View style={styles.amountCard}>
            <Txt variant="caption" color={Palette.textMuted}>
              {payKind === 'deposit' ? 'Deposit due' : 'Amount due'}
            </Txt>
            <Txt variant="display" mono glow color={Palette.accent} style={styles.amount}>
              {money(due)}
            </Txt>
            <Txt variant="caption" color={Palette.textMuted}>
              {booking.serviceName || 'Appointment'}
              {' · '}
              {formatWhen(booking.startsAt)}
            </Txt>
            {booking.price > 0 ? (
              <View style={styles.breakdown}>
                <Row label="Service total" value={money(booking.price)} />
                {booking.amountPaid > 0 ? (
                  <Row label="Already paid" value={`− ${money(booking.amountPaid)}`} />
                ) : null}
                {payKind === 'deposit' && booking.price > due ? (
                  <Row label="Balance at visit" value={money(Math.max(0, booking.price - due))} muted />
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.mockBanner}>
            <IconSymbol name="lock.fill" size={14} color={Palette.textMuted} />
            <Txt variant="caption" color={Palette.textMuted} style={{ flex: 1 }}>
              {PAYMENTS_PROVIDER === 'mock'
                ? 'Test mode — this is a simulated card. No real money moves.'
                : 'Payments are encrypted and processed securely.'}
            </Txt>
          </View>

          <Txt variant="label" style={styles.fieldLabel}>
            Card number
          </Txt>
          <View style={styles.cardField}>
            <IconSymbol name="creditcard" size={20} color={Palette.textMuted} />
            <TextInput
              value={card}
              onChangeText={setCard}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={Palette.textDim}
              keyboardType="number-pad"
              style={styles.cardInput}
            />
          </View>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="label" style={styles.fieldLabel}>
                Expiry
              </Txt>
              <TextInput
                value={exp}
                onChangeText={setExp}
                placeholder="MM / YY"
                placeholderTextColor={Palette.textDim}
                style={styles.smallInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="label" style={styles.fieldLabel}>
                CVC
              </Txt>
              <TextInput
                value={cvc}
                onChangeText={setCvc}
                placeholder="123"
                placeholderTextColor={Palette.textDim}
                keyboardType="number-pad"
                style={styles.smallInput}
              />
            </View>
          </View>

          <Pressable
            style={[styles.payBtn, paying && { opacity: 0.7 }]}
            disabled={paying}
            onPress={pay}
            accessibilityRole="button">
            {paying ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="label" color={Palette.black} style={{ fontWeight: '700' }}>
                Pay {money(due)}
              </Txt>
            )}
          </Pressable>

          {isNew ? (
            <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/bookings')} disabled={paying}>
              <Txt variant="label" color={Palette.textMuted}>
                Pay later
              </Txt>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt variant="caption" color={Palette.textMuted}>
        {label}
      </Txt>
      <Txt variant="caption" color={muted ? Palette.textMuted : Palette.text}>
        {value}
      </Txt>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  lead: { marginBottom: Spacing.lg, lineHeight: 20 },
  amountCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  amount: { marginVertical: Spacing.xs },
  breakdown: { alignSelf: 'stretch', marginTop: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  fieldLabel: { marginBottom: Spacing.xs },
  cardField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  cardInput: { flex: 1, color: Palette.text, fontSize: 16, paddingVertical: Spacing.md },
  cardRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  smallInput: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Palette.text,
    fontSize: 16,
  },
  payBtn: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Glow.md,
  },
  secondaryBtn: { paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
});
