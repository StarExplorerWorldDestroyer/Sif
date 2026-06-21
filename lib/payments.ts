import { getPaymentProvider } from '@/lib/payments/provider';
import { supabase } from '@/lib/supabase';
import type { Booking, Payment, PaymentKind, PaymentMethod } from '@/types';

function rowToPayment(row: any): Payment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    payerId: row.payer_id,
    payeeId: row.payee_id,
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? 'USD',
    kind: row.kind as PaymentKind,
    method: row.method as PaymentMethod,
    status: row.status,
    provider: row.provider ?? 'mock',
    providerRef: row.provider_ref ?? '',
    createdAt: row.created_at,
  };
}

/** Total a stylist has collected via booking payments (all time). */
export async function fetchStylistCollected(stylistId: string): Promise<number> {
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('payee_id', stylistId)
    .eq('status', 'succeeded');
  return round2((data ?? []).reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0));
}

/** Payments recorded against a booking, newest first. */
export async function listBookingPayments(bookingId: string): Promise<Payment[]> {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToPayment);
}

/** Amount still owed for a given payment kind on a booking. */
export function amountDueFor(booking: Booking, kind: PaymentKind): number {
  if (kind === 'deposit') return round2(Math.max(0, booking.depositAmount - booking.amountPaid));
  return round2(Math.max(0, booking.price - booking.amountPaid));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type RecordArgs = {
  bookingId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  kind: PaymentKind;
  method: PaymentMethod;
  provider: string;
  providerRef: string;
};

async function recordPayment(args: RecordArgs): Promise<void> {
  await supabase.from('payments').insert({
    booking_id: args.bookingId,
    payer_id: args.payerId,
    payee_id: args.payeeId,
    amount: args.amount,
    currency: args.currency,
    kind: args.kind,
    method: args.method,
    status: 'succeeded',
    provider: args.provider,
    provider_ref: args.providerRef,
  });
}

/**
 * Charge the client (via the active provider) for a booking and record the
 * payment. Called by the client paying a deposit or balance in-app.
 */
export async function payForBooking(params: {
  booking: Booking;
  kind: PaymentKind;
  currency: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { booking, kind, currency } = params;
  const amount = amountDueFor(booking, kind);
  if (amount <= 0) return { ok: false, error: 'Nothing left to pay on this booking.' };

  const provider = getPaymentProvider();
  const result = await provider.charge({
    amount,
    currency,
    description: `${labelForKind(kind)} for booking ${booking.id}`,
  });
  if (result.status !== 'succeeded') {
    return { ok: false, error: result.error ?? 'Your payment could not be processed.' };
  }

  await recordPayment({
    bookingId: booking.id,
    payerId: booking.clientId,
    payeeId: booking.stylistId,
    amount,
    currency,
    kind,
    method: 'app',
    provider: result.provider,
    providerRef: result.providerRef,
  });
  return { ok: true };
}

/**
 * Stylist records that the client paid the remaining balance out-of-band
 * (cash or other). No provider charge — just a ledger entry.
 */
export async function markPaidManually(params: {
  booking: Booking;
  method: Exclude<PaymentMethod, 'app'>;
  currency: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { booking, method, currency } = params;
  const amount = round2(Math.max(0, booking.price - booking.amountPaid));
  if (amount <= 0) return { ok: false, error: 'This booking is already fully paid.' };

  await recordPayment({
    bookingId: booking.id,
    payerId: booking.clientId,
    payeeId: booking.stylistId,
    amount,
    currency,
    kind: booking.amountPaid > 0 ? 'balance' : 'full',
    method,
    provider: 'manual',
    providerRef: '',
  });
  return { ok: true };
}

function labelForKind(kind: PaymentKind): string {
  if (kind === 'deposit') return 'Deposit';
  if (kind === 'balance') return 'Balance';
  return 'Payment';
}
