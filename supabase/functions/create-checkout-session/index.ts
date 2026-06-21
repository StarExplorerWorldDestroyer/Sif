// Sif: create a Stripe Checkout Session for a booking payment.
//
// POST { bookingId, kind: 'deposit'|'balance'|'full', successUrl?, cancelUrl? }
// Creates a destination charge to the stylist's connected account with an
// optional platform application fee. The payment row is written by the webhook
// (stripe-webhook) once Stripe confirms — never client-side.
//
// Deploy:  supabase functions deploy create-checkout-session
// Secrets: STRIPE_SECRET_KEY, optional PLATFORM_FEE_BPS (basis points, e.g. 1000 = 10%)

import { corsHeaders, getAdmin, getStripe, getUserId, json } from '../_shared/util.ts';

type Kind = 'deposit' | 'balance' | 'full';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = getAdmin();
  const stripe = getStripe();
  const uid = await getUserId(req, admin);
  if (!uid) return json({ error: 'Not authenticated.' }, 401);

  let body: { bookingId?: string; kind?: Kind; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const { bookingId } = body;
  const kind: Kind = body.kind === 'balance' ? 'balance' : body.kind === 'full' ? 'full' : 'deposit';
  if (!bookingId) return json({ error: 'Missing bookingId.' }, 400);

  const { data: booking } = await admin
    .from('bookings')
    .select('id, stylist_id, client_id, price, deposit_amount, amount_paid, service_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return json({ error: 'Booking not found.' }, 404);
  if (booking.client_id !== uid) return json({ error: 'Not your booking.' }, 403);

  const amountUnits =
    kind === 'deposit'
      ? round2(Math.max(0, Number(booking.deposit_amount) - Number(booking.amount_paid)))
      : round2(Math.max(0, Number(booking.price) - Number(booking.amount_paid)));
  if (amountUnits <= 0) return json({ error: 'Nothing due on this booking.' }, 400);

  // Stylist must have completed Connect onboarding to receive funds.
  const { data: acct } = await admin
    .from('stripe_accounts')
    .select('account_id, charges_enabled')
    .eq('user_id', booking.stylist_id)
    .maybeSingle();
  if (!acct?.account_id || !acct.charges_enabled) {
    return json({ error: 'This stylist isn’t set up to accept online payments yet.' }, 409);
  }

  const { data: clientProfile } = await admin
    .from('profiles')
    .select('currency')
    .eq('id', uid)
    .maybeSingle();
  const currency = (clientProfile?.currency ?? 'USD').toLowerCase();

  let serviceName = 'Appointment';
  if (booking.service_id) {
    const { data: svc } = await admin
      .from('stylist_services')
      .select('name')
      .eq('id', booking.service_id)
      .maybeSingle();
    if (svc?.name) serviceName = svc.name;
  }

  const unitAmount = Math.round(amountUnits * 100);
  const feeBps = Number(Deno.env.get('PLATFORM_FEE_BPS') ?? '0');
  const applicationFee = feeBps > 0 ? Math.round((unitAmount * feeBps) / 10000) : 0;
  const appUrl = Deno.env.get('APP_URL') || 'https://goldensif.com';
  const label = kind === 'deposit' ? 'Deposit' : kind === 'balance' ? 'Balance' : 'Payment';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: `${serviceName} — ${label}` },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
      transfer_data: { destination: acct.account_id },
    },
    success_url: body.successUrl || `${appUrl}/bookings?paid=1`,
    cancel_url: body.cancelUrl || `${appUrl}/bookings`,
    metadata: {
      booking_id: booking.id,
      payer_id: booking.client_id,
      payee_id: booking.stylist_id,
      kind,
      amount: String(amountUnits),
      currency,
    },
  });

  return json({ url: session.url, id: session.id });
});
