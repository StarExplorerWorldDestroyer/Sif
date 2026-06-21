/**
 * Active payment provider. Flip to 'stripe' once the Stripe edge functions and
 * publishable key are wired up (see lib/payments/stripe-provider.ts). Until then
 * the mock provider simulates a successful charge so the full flow is usable.
 */
export const PAYMENTS_PROVIDER: 'mock' | 'stripe' = 'stripe';
