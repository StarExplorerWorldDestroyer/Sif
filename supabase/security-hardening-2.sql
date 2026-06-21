-- Sif: security hygiene (Phase 4).
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings-followups.sql.

-- ============================================================
-- Stop relationship probing via has_booking()
-- ============================================================
-- has_booking() is used inside the haircuts INSERT policy (where auth.uid() is
-- the stylist), but it was also callable directly by any authenticated user to
-- test whether two arbitrary people share a booking. Require the caller to be
-- one of the two parties; otherwise it returns false. This keeps the RLS use
-- working while removing the probe.
create or replace function public.has_booking(stylist uuid, client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() in (stylist, client) and exists (
    select 1 from public.bookings b
    where b.stylist_id = stylist
      and b.client_id = client
      and b.status in ('confirmed', 'completed')
  );
$$;
