import { PAYMENTS_PROVIDER } from '@/constants/payments';
import { getPaymentProvider } from '@/lib/payments/provider';
import { startBookingCheckout } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import type { Booking, PaymentKind, PaymentMethod } from '@/types';

/** Total a stylist has collected via booking payments (all time). */
export async function fetchStylistCollected(stylistId: string): Promise<number> {
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('payee_id', stylistId)
    .eq('status', 'succeeded');
  return round2((data ?? []).reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0));
}

/** Amount still owed for a given payment kind on a booking. */
export function amountDueFor(booking: Booking, kind: PaymentKind): number {
  if (kind === 'deposit') return round2(Math.max(0, booking.depositAmount - booking.amountPaid));
  return round2(Math.max(0, booking.price - booking.amountPaid));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Charge the client (via the active provider) for a booking and record the
 * payment. Called by the client paying a deposit or balance in-app.
 *
 * The payment row is written server-side (Stripe webhook for real money, or the
 * `pay_booking_mock` RPC for the mock provider) which recomputes the amount from
 * the booking — the client never names its own price.
 */
export async function payForBooking(params: {
  booking: Booking;
  kind: PaymentKind;
  currency: string;
}): Promise<{ ok: boolean; error?: string; redirected?: boolean }> {
  const { booking, kind, currency } = params;
  const amount = amountDueFor(booking, kind);
  if (amount <= 0) return { ok: false, error: 'Nothing left to pay on this booking.' };

  // Real money goes through Stripe Checkout: the server creates the session and
  // the webhook records the payment. We never touch card data or insert here.
  if (PAYMENTS_PROVIDER === 'stripe') {
    return startBookingCheckout(booking.id, kind);
  }

  const provider = getPaymentProvider();
  const result = await provider.charge({
    amount,
    currency,
    description: `${labelForKind(kind)} for booking ${booking.id}`,
  });
  if (result.status !== 'succeeded') {
    return { ok: false, error: result.error ?? 'Your payment could not be processed.' };
  }

  // The amount is recomputed in the RPC from the booking, so a tampered client
  // can't record an arbitrary amount.
  const { error } = await supabase.rpc('pay_booking_mock', {
    p_booking_id: booking.id,
    p_kind: kind,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Stylist records that the client paid the remaining balance out-of-band
 * (cash or other). The RPC validates the caller is the stylist and computes the
 * outstanding balance server-side.
 */
export async function markPaidManually(params: {
  booking: Booking;
  method: Exclude<PaymentMethod, 'app'>;
  currency: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { booking, method } = params;
  const amount = round2(Math.max(0, booking.price - booking.amountPaid));
  if (amount <= 0) return { ok: false, error: 'This booking is already fully paid.' };

  const { error } = await supabase.rpc('record_manual_payment', {
    p_booking_id: booking.id,
    p_method: method,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function labelForKind(kind: PaymentKind): string {
  if (kind === 'deposit') return 'Deposit';
  if (kind === 'balance') return 'Balance';
  return 'Payment';
}
