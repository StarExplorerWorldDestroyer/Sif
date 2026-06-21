// Sif: Stripe webhook — records booking payments after Stripe confirms.
//
// Handles:
//   checkout.session.completed -> insert a succeeded payment row (idempotent on
//                                 the session id); the DB trigger then updates
//                                 the booking's amount_paid / payment_status.
//   account.updated            -> sync the stylist's connected-account status.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Then add the function URL as a webhook endpoint in the Stripe dashboard and
// subscribe to `checkout.session.completed` and `account.updated`.

import Stripe from 'npm:stripe@18';
import { getAdmin, getStripe } from '../_shared/util.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const stripe = getStripe();
  const admin = getAdmin();
  const sig = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const raw = await req.text();

  if (!sig || !secret) return new Response('Missing signature.', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, cryptoProvider);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, {
      status: 400,
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid' && session.metadata) {
      const m = session.metadata;
      // Reconcile against the booking: trust the DB for the parties and Stripe's
      // own amount_total for the figure, not the (mutable) metadata amount.
      const { data: bk } = await admin
        .from('bookings')
        .select('id, client_id, stylist_id')
        .eq('id', m.booking_id)
        .maybeSingle();
      if (!bk) return new Response('Unknown booking', { status: 400 });
      if (bk.client_id !== m.payer_id || bk.stylist_id !== m.payee_id) {
        return new Response('Booking/party mismatch', { status: 400 });
      }
      const amount =
        typeof session.amount_total === 'number'
          ? session.amount_total / 100
          : Number(m.amount ?? 0);

      const { error } = await admin.from('payments').insert({
        booking_id: bk.id,
        payer_id: bk.client_id,
        payee_id: bk.stylist_id,
        amount,
        currency: (session.currency ?? m.currency ?? 'usd').toUpperCase(),
        kind: m.kind ?? 'full',
        method: 'app',
        status: 'succeeded',
        provider: 'stripe',
        provider_ref: typeof session.payment_intent === 'string' ? session.payment_intent : '',
        stripe_session_id: session.id,
      });
      // 23505 = duplicate (webhook retry) — safe to ignore.
      if (error && error.code !== '23505') {
        return new Response(`DB error: ${error.message}`, { status: 500 });
      }
    }
  } else if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    await admin
      .from('stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', account.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
