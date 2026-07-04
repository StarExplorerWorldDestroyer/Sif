-- Sif: disable mock in-app payments in PRODUCTION.
-- Applied to production via the Supabase MCP (migration:
--   disable_mock_payments_in_prod). Kept here so the repo mirrors production.
-- Safe to re-run (idempotent).
--
-- Why: `pay_booking_mock` records a succeeded payment without real money — a
-- dev/staging convenience for exercising the deposit/balance flow. Left
-- callable in prod, a tampered client could mark any of its bookings paid,
-- even after the app switches to Stripe. So in production no client role may
-- execute it. The definition stays (harmless with no grants) and the webhook /
-- service role paths are unaffected. `record_manual_payment` (stylist marks a
-- cash payment) is a real feature and keeps its grant.
--
-- In DEV/STAGING, where PAYMENTS_PROVIDER = 'mock', re-enable with:
--   grant execute on function public.pay_booking_mock(uuid, text) to authenticated;

revoke execute on function public.pay_booking_mock(uuid, text) from public, anon, authenticated;
