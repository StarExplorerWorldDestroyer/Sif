// Sif: Stripe Connect onboarding for stylists.
//
// POST { action: 'onboard' | 'status', returnUrl?: string }
//   onboard -> ensures a connected account exists and returns a hosted
//              onboarding (Account Link) URL.
//   status  -> refreshes the account's capabilities from Stripe and returns
//              { charges_enabled, payouts_enabled, details_submitted }.
//
// Deploy:  supabase functions deploy stripe-connect
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_...
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { getAdmin, getStripe, getUserId, json, safeRedirect, withCors } from '../_shared/util.ts';

Deno.serve((req) =>
  withCors(req, async () => {
    const admin = getAdmin();
    const stripe = getStripe();

    try {
    const uid = await getUserId(req, admin);
    if (!uid) return json({ error: 'Not authenticated.' }, 401);

    let body: { action?: string; returnUrl?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine
    }
    const action = body.action ?? 'onboard';
    const appUrl = safeRedirect(body.returnUrl, Deno.env.get('APP_URL') || 'https://goldensif.com');

    // Load or create the connected account.
    const { data: existing } = await admin
      .from('stripe_accounts')
      .select('account_id')
      .eq('user_id', uid)
      .maybeSingle();

    let accountId = existing?.account_id ?? null;

    if (!accountId) {
      if (action === 'status') return json({ charges_enabled: false, details_submitted: false });
      const { data: profile } = await admin
        .from('profiles')
        .select('username, display_name, is_stylist')
        .eq('id', uid)
        .maybeSingle();
      // Only stylist accounts can onboard for payouts.
      if (!profile?.is_stylist) {
        return json({ error: 'Only stylist accounts can set up payouts.' }, 403);
      }
      const { data: authUser } = await admin.auth.admin.getUserById(uid);

      const account = await stripe.accounts.create({
        // Modern Connect: platform controls fees + loss liability, stylist gets
        // an Express dashboard. Stripe collects the required onboarding info.
        controller: {
          stripe_dashboard: { type: 'express' },
          fees: { payer: 'application' },
          losses: { payments: 'application' },
          requirement_collection: 'stripe',
        },
        email: authUser?.user?.email ?? undefined,
        metadata: { sif_user_id: uid, username: profile?.username ?? '' },
      });
      accountId = account.id;
      await admin.from('stripe_accounts').upsert(
        { user_id: uid, account_id: accountId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    }

    if (action === 'status') {
      const account = await stripe.accounts.retrieve(accountId);
      const status = {
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
      };
      await admin
        .from('stripe_accounts')
        .update({ ...status, updated_at: new Date().toISOString() })
        .eq('user_id', uid);
      return json(status);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard?connect=refresh`,
      return_url: `${appUrl}/dashboard?connect=done`,
      type: 'account_onboarding',
    });
    return json({ url: link.url });
    } catch (err) {
      console.error('stripe-connect error:', err);
      return json({ error: 'Could not start payout onboarding. Please try again.' }, 500);
    }
  }),
);
