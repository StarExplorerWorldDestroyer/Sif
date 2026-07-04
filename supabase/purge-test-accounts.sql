-- Sif: pre-launch purge of seeded demo/test accounts.
-- Applied to production via the Supabase MCP (migration:
--   purge_test_accounts_and_demo_triggers). Kept here so the repo mirrors
-- production. Safe to re-run (idempotent).
--
-- Why: test-accounts.sql (local/staging demo seed) had been run against
-- production. Its 14 accounts shared a single, repo-visible password, and the
-- auto-accept/auto-follow demo triggers let anyone force a connection with
-- them. All of it is removed from prod:
--
--   1. Demo triggers + their functions (auto-accept connection, follow-back).
--   2. Seed helper functions (seed_test_user, seed_test_post).
--   3. The seeded auth.users rows — cascades to profiles, haircuts, photos,
--      posts, follows, connections, notifications, and availability.
--      (Verified beforehand: no real bookings or conversations referenced any
--      test account.)
--
-- The profiles.is_test column intentionally stays (default false): other
-- idempotent setup SQL references it, and it's harmless.
--
-- test-accounts.sql remains in the repo for local/staging demos only — heed
-- its "DO NOT RUN IN PRODUCTION" warning.

drop trigger if exists trg_auto_accept_test_connection on public.connections;
drop trigger if exists trg_auto_follow_back_test on public.follows;
drop function if exists public.auto_accept_test_connection();
drop function if exists public.auto_follow_back_test();

drop function if exists public.seed_test_user(text, text, text, text, text, boolean, text, text, text);
drop function if exists public.seed_test_post(uuid, text, text, text, uuid);

delete from auth.users
where id in (select id from public.profiles where is_test);
