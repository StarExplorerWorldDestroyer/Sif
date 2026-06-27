-- Sif: pre-launch security advisor hardening.
-- Applied to production via the Supabase MCP (migrations:
--   security_advisor_hardening, lock_down_wants_notifications).
-- Kept here so the repo mirrors production. Safe to re-run (idempotent).
--
-- What this does, and why:
--   1. Public buckets (avatars, haircut-photos) had a broad SELECT policy that
--      let anyone LIST every object. Public object URLs do not need it, so we
--      drop it — image URLs keep working, enumeration stops.
--   2. Trigger / cron / seed / test functions don't need any client EXECUTE
--      (triggers run as the table owner; cron runs as postgres; seed helpers are
--      service-role only). We revoke EXECUTE from public/anon/authenticated. This
--      notably closes seed_test_user / seed_test_post, which were anon-callable.
--   3. Client RPCs are restricted to `authenticated` only (drop the implicit
--      anon/PUBLIC grant), shrinking the logged-out attack surface.
--   4. One trigger function had a mutable search_path; we pin it.
--
-- Intentionally NOT changed (documented so future audits don't "re-fix" them):
--   * is_blocked / is_connected / has_booking keep anon+authenticated EXECUTE.
--     They are referenced by `to public` RLS policies on profiles/posts/messages/
--     haircuts, so revoking would break public reads. They return only booleans
--     and require knowing both user UUIDs.
--   * pg_net / btree_gist live in `public`. Moving them risks breaking the push
--     pipeline (pg_net) and the bookings no-overlap exclusion constraint
--     (btree_gist) for a low-severity lint; left in place deliberately.
--   * public.push_config has RLS enabled with no policy — that is the intended
--     deny-all (service role only) state.
--
-- Still requires a dashboard toggle (no SQL/API): enable Auth → leaked password
-- protection (HaveIBeenPwned).

-- 1) Storage: drop broad public-read (listing) policies.
drop policy if exists "public read avatars" on storage.objects;
drop policy if exists "public read haircut photos" on storage.objects;

-- 2a) Trigger functions: no client needs EXECUTE.
revoke execute on function public.auto_accept_test_connection() from public, anon, authenticated;
revoke execute on function public.auto_follow_back_test() from public, anon, authenticated;
revoke execute on function public.guard_booking_status() from public, anon, authenticated;
revoke execute on function public.notify_booking_requested() from public, anon, authenticated;
revoke execute on function public.notify_booking_status() from public, anon, authenticated;
revoke execute on function public.notify_connection_accepted() from public, anon, authenticated;
revoke execute on function public.notify_connection_request() from public, anon, authenticated;
revoke execute on function public.notify_follow() from public, anon, authenticated;
revoke execute on function public.notify_message() from public, anon, authenticated;
revoke execute on function public.notify_pending_cut() from public, anon, authenticated;
revoke execute on function public.notify_post_comment() from public, anon, authenticated;
revoke execute on function public.notify_post_like() from public, anon, authenticated;
revoke execute on function public.notify_post_tag() from public, anon, authenticated;
revoke execute on function public.notify_push() from public, anon, authenticated;
revoke execute on function public.notify_review() from public, anon, authenticated;
revoke execute on function public.notify_review_reply() from public, anon, authenticated;
revoke execute on function public.recompute_booking_payment() from public, anon, authenticated;
revoke execute on function public.reset_booking_reminders() from public, anon, authenticated;
revoke execute on function public.set_booking_pricing() from public, anon, authenticated;
revoke execute on function public.touch_conversation() from public, anon, authenticated;
revoke execute on function public.set_booking_blocked() from public, anon, authenticated;

-- 2b) Cron-only function.
revoke execute on function public.process_booking_reminders() from public, anon, authenticated;

-- 2c) Test/seed helpers: service role only.
revoke execute on function public.seed_test_user(text, text, text, text, text, boolean, text, text, text) from public, anon, authenticated;
revoke execute on function public.seed_test_post(uuid, text, text, text, uuid) from public, anon, authenticated;

-- 2d) Internal notify helper (only called inside SECURITY DEFINER triggers).
revoke execute on function public.wants_notifications(uuid) from public, anon, authenticated;

-- 3) Client RPCs: authenticated only.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.list_blocked_users()',
    'public.list_conversations()',
    'public.list_stylists(text)',
    'public.profile_card(text)',
    'public.profile_cards_by_ids(uuid[])',
    'public.search_profiles(text)',
    'public.stylist_earnings()',
    'public.get_or_create_conversation(uuid)',
    'public.block_user(uuid)',
    'public.unblock_user(uuid)',
    'public.report_content(text, uuid, uuid, text)',
    'public.record_manual_payment(uuid, text)',
    'public.pay_booking_mock(uuid, text)',
    'public.set_booking_price(uuid, numeric)',
    'public.set_review_reply(uuid, text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;

-- 4) Pin the one flagged mutable search_path.
alter function public.set_booking_blocked() set search_path = '';
