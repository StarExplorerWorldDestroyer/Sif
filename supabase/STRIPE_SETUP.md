# Stripe payments setup

Sif uses **Stripe Connect** as a marketplace: clients pay the platform via Stripe
Checkout, and funds are routed to the stylist's connected account with a
**destination charge** (plus an optional platform fee). Payments are recorded by
a webhook — never client-side — so the ledger always matches Stripe.

Until this is configured, leave `PAYMENTS_PROVIDER = 'mock'` in
`constants/payments.ts` (the in-app simulated card flow keeps working).

## 1. Database

Run these in the Supabase SQL Editor, in order:

1. `supabase/payments.sql`
2. `supabase/stripe.sql`

## 2. Enable Connect

In the Stripe Dashboard, enable **Connect** (Settings → Connect). Test mode is
fine to start.

## 3. Set function secrets

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  APP_URL=https://goldensif.com \
  PLATFORM_FEE_BPS=0
```

- `PLATFORM_FEE_BPS` is the platform's cut in basis points (e.g. `1000` = 10%).
  `0` (default) takes no fee.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 4. Deploy the edge functions

```bash
supabase functions deploy stripe-connect
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

`stripe-webhook` uses `--no-verify-jwt` because Stripe (not a logged-in user)
calls it; it's authenticated by the Stripe signature instead.

## 5. Register the webhook

Stripe Dashboard → Developers → Webhooks → **Add endpoint**:

- URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`
- Events: `checkout.session.completed`, `account.updated`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (step 3) and redeploy if it
changed.

## 6. Go live in the app

Set `PAYMENTS_PROVIDER = 'stripe'` in `constants/payments.ts`, then ship.

- **Stylists**: Dashboard → **Set up payouts** runs Stripe Connect onboarding.
  Until a stylist finishes onboarding (`charges_enabled`), their booking
  checkout returns a friendly "not set up to accept payments yet" message.
- **Clients**: the deposit/balance buttons open Stripe Checkout; on success the
  webhook records the payment and the booking's status flips automatically.

## Testing

In Stripe test mode, use card `4242 4242 4242 4242`, any future expiry, any CVC.
Watch payments land on the stylist dashboard ("Collected via bookings").

## Upgrading the in-app experience (optional, later)

Checkout is a hosted redirect (works on web + native, minimal PCI surface). To
keep payment fully in-app, swap to the **Payment Element** (web) /
**PaymentSheet** (`@stripe/stripe-react-native`, native) backed by a
`create-payment-intent` function — the webhook + ledger stay the same.
