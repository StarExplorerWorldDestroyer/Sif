import type { ChargeRequest, ChargeResult, PaymentProvider } from '@/lib/payments/provider';

/**
 * Real Stripe (Connect) provider — stubbed until wired.
 *
 * Production path (no card data ever touches this client directly):
 *   1. Client calls a Supabase Edge Function `create-payment-intent` with the
 *      booking id + kind (deposit | balance | full). The function (service role)
 *      computes the amount in cents, looks up the stylist's connected account,
 *      and creates a PaymentIntent with `application_fee_amount` +
 *      `transfer_data.destination` for the marketplace payout.
 *   2. Confirm the PaymentIntent with @stripe/stripe-react-native
 *      (initPaymentSheet / presentPaymentSheet).
 *   3. A Stripe webhook (`payment_intent.succeeded`) → Edge Function inserts the
 *      row into `public.payments` with the service role, which fires the
 *      recompute trigger and updates the booking's payment_status.
 *
 * Amounts cross the boundary as whole units here and are converted to cents
 * inside the edge function (Math.round(amount * 100)).
 */
export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async charge(_req: ChargeRequest): Promise<ChargeResult> {
    return {
      status: 'failed',
      providerRef: '',
      provider: 'stripe',
      error:
        'Stripe is not configured yet. Set up the Connect account, edge functions, and publishable key, then flip PAYMENTS_PROVIDER.',
    };
  },
};
