-- Sif: per-user appointment reminder cadence.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings-followups.sql.
--
-- Replaces the single 24h "reminder_sent" flag with a flexible system:
--   * each user picks their own reminder lead times (profiles.booking_reminder_minutes)
--   * default is a single 24h reminder ({1440})
--   * each (booking, user, window) fires exactly once, tracked in a log table
--   * rescheduling a booking clears its log so the reminders fire again
-- The reminder engine (process_booking_reminders) is rewritten to honor this.

-- ============================================================
-- Per-user reminder cadence (minutes before the appointment)
-- ============================================================
alter table public.profiles
  add column if not exists booking_reminder_minutes int[] not null default array[1440];

-- ============================================================
-- Per-window "already reminded" log (one row per fired reminder)
-- ============================================================
create table if not exists public.booking_reminders_sent (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  minutes_before int not null,
  sent_at timestamptz not null default now(),
  primary key (booking_id, user_id, minutes_before)
);

alter table public.booking_reminders_sent enable row level security;

-- Users can see their own reminder log; inserts happen only via the
-- SECURITY DEFINER RPC below (service-side), so there is no insert policy.
drop policy if exists "read own reminder log" on public.booking_reminders_sent;
create policy "read own reminder log" on public.booking_reminders_sent
  for select using (auth.uid() = user_id);

-- ============================================================
-- Reset reminders when a booking is moved
-- ============================================================
create or replace function public.reset_booking_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    delete from public.booking_reminders_sent where booking_id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_reset_booking_reminders on public.bookings;
create trigger trg_reset_booking_reminders
  before update of starts_at on public.bookings
  for each row execute function public.reset_booking_reminders();

-- ============================================================
-- Reminder engine: honor each recipient's chosen windows
-- ============================================================
-- For every confirmed, upcoming booking, fan out to both parties, then to each
-- of that party's chosen lead times. A reminder fires when its window has been
-- reached (starts_at - lead <= now) but only if that window was still in the
-- future when the booking was created (so a last-minute booking doesn't trigger
-- a stale "24h before" ping). Each (booking, user, window) is logged so it can
-- never double-fire. SECURITY DEFINER + idempotent: safe from any client on
-- open and from pg_cron.
create or replace function public.process_booking_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with recipients as (
    select b.id as booking_id, b.starts_at, b.created_at,
           b.client_id as user_id, b.stylist_id as actor_id
    from public.bookings b
    where b.status = 'confirmed' and b.starts_at > now()
    union all
    select b.id, b.starts_at, b.created_at,
           b.stylist_id as user_id, b.client_id as actor_id
    from public.bookings b
    where b.status = 'confirmed' and b.starts_at > now()
  ),
  due as (
    select r.booking_id, r.user_id, r.actor_id, m.minutes_before
    from recipients r
    cross join lateral unnest(
      coalesce(
        (select booking_reminder_minutes from public.profiles where id = r.user_id),
        array[1440]
      )
    ) as m(minutes_before)
    where public.wants_notifications(r.user_id)
      and r.starts_at - make_interval(mins => m.minutes_before) <= now()
      and r.created_at <= r.starts_at - make_interval(mins => m.minutes_before)
      and not exists (
        select 1 from public.booking_reminders_sent s
        where s.booking_id = r.booking_id
          and s.user_id = r.user_id
          and s.minutes_before = m.minutes_before
      )
  ),
  ins as (
    insert into public.notifications (user_id, actor_id, type, entity_id)
    select user_id, actor_id, 'booking_reminder', booking_id
    from due
    returning 1
  )
  insert into public.booking_reminders_sent (booking_id, user_id, minutes_before)
  select booking_id, user_id, minutes_before from due;
end; $$;

grant execute on function public.process_booking_reminders() to authenticated;

-- ============================================================
-- Scheduling (best-effort; same job name as before, so this just refreshes it)
-- ============================================================
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
      '*/5 * * * *',
      $cron$ select public.process_booking_reminders(); $cron$
    );
  exception when others then
    raise notice 'cron.schedule unavailable; relying on client-triggered reminders';
  end;
end $$;
