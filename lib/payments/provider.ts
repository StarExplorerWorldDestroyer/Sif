import { PAYMENTS_PROVIDER } from '@/constants/payments';
import { mockProvider } from '@/lib/payments/mock-provider';
import { stripeProvider } from '@/lib/payments/stripe-provider';

/** A charge request, in whole currency units (e.g. dollars, not cents). */
export type ChargeRequest = {
  amount: number;
  currency: string;
  description: string;
};

export type ChargeResult = {
  status: 'succeeded' | 'failed';
  /** Provider transaction reference (e.g. a Stripe PaymentIntent id). */
  providerRef: string;
  provider: string;
  error?: string;
};

/**
 * Pluggable payment backend. The app talks to this interface only; swapping
 * mock ↔ Stripe is a one-line change in constants/payments.ts.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

export function getPaymentProvider(): PaymentProvider {
  return PAYMENTS_PROVIDER === 'stripe' ? stripeProvider : mockProvider;
}
