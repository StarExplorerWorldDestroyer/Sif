-- Sif: booking follow-ups.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings.sql (and test-accounts.sql for the seed section).
--
-- 1) Seed weekly availability for the test stylist accounts so the directory
--    has bookable demos.
-- 2) Let a stylist create a cut for a client they have a booking with (not
--    just connected clients).
-- 3) Booking reminders: a notification to both parties ~24h before a confirmed
--    appointment, driven by a callable RPC (and pg_cron when available).

-- ============================================================
-- 1) Seed availability for test stylists
-- ============================================================
insert into public.stylist_booking_settings (stylist_id, slot_minutes, accepts_bookings)
select id, 60, true
from public.profiles
where is_stylist = true and coalesce(is_test, false) = true
on conflict (stylist_id) do update
  set slot_minutes = excluded.slot_minutes, accepts_bookings = true;

delete from public.stylist_availability
where stylist_id in (
  select id from public.profiles where is_stylist = true and coalesce(is_test, false) = true
);

-- Mon–Fri 9:00–17:00 and Sat 10:00–15:00 for every test stylist.
insert into public.stylist_availability (stylist_id, weekday, start_min, end_min)
select p.id, w.weekday, w.start_min, w.end_min
from public.profiles p
cross join (values
  (1, 540, 1020),
  (2, 540, 1020),
  (3, 540, 1020),
  (4, 540, 1020),
  (5, 540, 1020),
  (6, 600, 900)
) as w(weekday, start_min, end_min)
where p.is_stylist = true and coalesce(p.is_test, false) = true;

-- ============================================================
-- 2) Allow stylist → client cut creation when a booking exists
-- ============================================================
create or replace function public.has_booking(stylist uuid, client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.stylist_id = stylist
      and b.client_id = client
      and b.status in ('confirmed', 'completed')
  );
$$;

grant execute on function public.has_booking(uuid, uuid) to authenticated;

drop policy if exists "insert haircuts" on public.haircuts;
create policy "insert haircuts" on public.haircuts
  for insert with check (
    (user_id = auth.uid() and created_by = auth.uid())
    or (
      created_by = auth.uid()
      and status = 'pending'
      and (
        public.is_connected(auth.uid(), user_id)
        or public.has_booking(auth.uid(), user_id)
      )
    )
  );

-- ============================================================
-- 3) Booking reminders
-- ============================================================
alter table public.bookings
  add column if not exists reminder_sent boolean not null default false;

-- Insert a 'booking_reminder' for both parties of confirmed bookings starting
-- within the next 24h that haven't been reminded yet, then mark them sent.
-- SECURITY DEFINER + idempotent so it's safe to call from any client on open
-- (and from pg_cron). It only ever touches legitimate, due bookings.
create or replace function public.process_booking_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with due as (
    select id, client_id, stylist_id
    from public.bookings
    where status = 'confirmed'
      and reminder_sent = false
      and starts_at > now()
      and starts_at <= now() + interval '24 hours'
  ),
  ins as (
    insert into public.notifications (user_id, actor_id, type, entity_id)
    select client_id, stylist_id, 'booking_reminder', id
    from due where public.wants_notifications(client_id)
    union all
    select stylist_id, client_id, 'booking_reminder', id
    from due where public.wants_notifications(stylist_id)
    returning 1
  )
  update public.bookings
  set reminder_sent = true
  where id in (select id from due);
end; $$;

grant execute on function public.process_booking_reminders() to authenticated;

-- Best-effort scheduling via pg_cron. If the extension isn't enabled, this is a
-- no-op and reminders still fire when clients call the RPC on app open.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable; relying on client-triggered reminders';
  end;
  begin
    perform cron.schedule(
      'booking-reminders',
      '*/15 * * * *',
      $cron$ select public.process_booking_reminders(); $cron$
    );
  exception when others then
    raise notice 'cron.schedule unavailable; relying on client-triggered reminders';
  end;
end $$;
