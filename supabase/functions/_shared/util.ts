// Shared helpers for the Stripe edge functions.
import Stripe from 'npm:stripe@18';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Stripe client configured for the Deno (fetch) runtime. */
export function getStripe(): Stripe {
  return new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** Supabase admin client (service role — bypasses RLS). */
export function getAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Resolve the calling user's id from the request's bearer token. */
export async function getUserId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

/**
 * Validate a client-supplied redirect URL against an allowlist so it can't be
 * used as an open redirect after Stripe checkout / Connect onboarding. Permits
 * the app's own origins and the `sif://` mobile scheme; otherwise returns the
 * trusted fallback.
 */
export function safeRedirect(candidate: string | undefined, fallback: string): string {
  if (!candidate) return fallback;
  if (candidate.startsWith('sif://')) return candidate;
  const appUrl = Deno.env.get('APP_URL') || 'https://goldensif.com';
  const allowed = [appUrl, 'https://goldensif.com', 'https://www.goldensif.com'];
  try {
    const origin = new URL(candidate).origin;
    const ok = allowed.some((a) => {
      try {
        return new URL(a).origin === origin;
      } catch {
        return false;
      }
    });
    return ok ? candidate : fallback;
  } catch {
    return fallback;
  }
}
