-- Sif: Stripe Connect — connected accounts + payment idempotency.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER payments.sql.
--
-- Stripe integration is a marketplace (Connect): clients pay the platform, and
-- funds are routed to the stylist's connected account via a destination charge
-- with an optional application fee. The edge functions (service role) write to
-- these tables; clients only read their own connected-account status.

-- ============================================================
-- Stylist connected accounts
-- ============================================================
create table if not exists public.stripe_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_id text not null,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.stripe_accounts enable row level security;

-- Owners can see their own account status (for the onboarding UI). Writes only
-- happen via edge functions using the service role, which bypasses RLS.
drop policy if exists "read own stripe account" on public.stripe_accounts;
create policy "read own stripe account" on public.stripe_accounts
  for select using (auth.uid() = user_id);

-- ============================================================
-- Payment idempotency for the Stripe webhook
-- ============================================================
alter table public.payments
  add column if not exists stripe_session_id text;

-- A Checkout Session maps to exactly one payment row; the unique index lets the
-- webhook safely retry without double-recording.
create unique index if not exists payments_stripe_session_idx
  on public.payments (stripe_session_id)
  where stripe_session_id is not null;
