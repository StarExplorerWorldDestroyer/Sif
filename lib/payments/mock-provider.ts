import type { ChargeRequest, ChargeResult, PaymentProvider } from '@/lib/payments/provider';

/**
 * A simulated card processor for development. Approves every charge after a
 * short delay so the deposit/balance flow is fully clickable without real
 * money. Swap to the Stripe provider when ready (constants/payments.ts).
 */
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    await new Promise((r) => setTimeout(r, 1200));
    const ref = `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return { status: 'succeeded', providerRef: ref, provider: 'mock' };
  },
};
