import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type ConnectStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

/** Pull an { error } message out of a non-2xx edge-function response. */
async function fnError(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (ctx?.json) {
      const j = await ctx.json();
      if (j?.error) return j.error;
    }
  } catch {
    // fall through
  }
  return fallback;
}

function openUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.location.href = url;
  } else {
    Linking.openURL(url);
  }
}

/** Open hosted Stripe Connect onboarding for the current stylist. */
export async function startConnectOnboarding(): Promise<{ ok: boolean; error?: string }> {
  const returnUrl = Platform.OS === 'web' ? window.location.origin : undefined;
  const { data, error } = await supabase.functions.invoke('stripe-connect', {
    body: { action: 'onboard', returnUrl },
  });
  if (error) return { ok: false, error: await fnError(error, 'Could not start onboarding.') };
  if (!data?.url) return { ok: false, error: 'Could not start onboarding.' };
  openUrl(data.url);
  return { ok: true };
}

/** Refresh and return the stylist's connected-account capabilities. */
export async function fetchConnectStatus(): Promise<ConnectStatus> {
  const { data } = await supabase.functions.invoke('stripe-connect', {
    body: { action: 'status' },
  });
  return {
    chargesEnabled: !!data?.charges_enabled,
    payoutsEnabled: !!data?.payouts_enabled,
    detailsSubmitted: !!data?.details_submitted,
  };
}

/** Start a Checkout Session for a booking payment and redirect to Stripe. */
export async function startBookingCheckout(
  bookingId: string,
  kind: 'deposit' | 'balance' | 'full',
): Promise<{ ok: boolean; error?: string; redirected?: boolean }> {
  const successUrl = Platform.OS === 'web' ? `${window.location.origin}/bookings?paid=1` : undefined;
  const cancelUrl = Platform.OS === 'web' ? `${window.location.origin}/bookings` : undefined;
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { bookingId, kind, successUrl, cancelUrl },
  });
  if (error) return { ok: false, error: await fnError(error, 'Could not start checkout.') };
  if (!data?.url) return { ok: false, error: data?.error ?? 'Could not start checkout.' };
  openUrl(data.url);
  return { ok: true, redirected: true };
}
