// Shared helpers for the Stripe edge functions.
import Stripe from 'npm:stripe@18';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Browser callers we trust. Native apps don't send an `Origin`, so CORS never
// applies to them — this list only gates web (and local dev) origins. Anything
// off-list falls back to the canonical origin so we never echo `*`.
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'https://goldensif.com',
  'https://goldensif.com',
  'https://www.goldensif.com',
];

function resolveOrigin(req: Request): string {
  const origin = req.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

/** CORS headers scoped to the request's origin (allowlisted), never `*`. */
export function corsHeadersFor(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(req),
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Static fallback for any response not produced through `withCors`. Points at
// the canonical origin rather than a wildcard.
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Wrap a request handler so every response carries origin-scoped CORS headers
 * and OPTIONS preflights are answered automatically. Lets handlers keep using
 * `json(...)` without threading the request through each call site.
 */
export async function withCors(
  req: Request,
  handler: () => Promise<Response> | Response,
): Promise<Response> {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const res = await handler();
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

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
