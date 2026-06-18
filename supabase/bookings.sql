-- Sif: stylist discovery + slot-based booking.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER social.sql and notifications.sql.
--
-- Model:
--   stylist_booking_settings : per-stylist slot length + accepting toggle
--   stylist_availability     : recurring weekly windows (weekday + minute range)
--   bookings                 : a client's request for a specific time slot
-- Times in availability are minutes-from-midnight interpreted in local time;
-- bookings store an absolute timestamptz for the chosen slot.

-- ============================================================
-- Per-stylist booking settings
-- ============================================================
create table if not exists public.stylist_booking_settings (
  stylist_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  slot_minutes int not null default 60 check (slot_minutes between 5 and 480),
  accepts_bookings boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.stylist_booking_settings enable row level security;

drop policy if exists "read booking settings" on public.stylist_booking_settings;
create policy "read booking settings" on public.stylist_booking_settings
  for select using (true);

drop policy if exists "manage own booking settings" on public.stylist_booking_settings;
create policy "manage own booking settings" on public.stylist_booking_settings
  for all using (auth.uid() = stylist_id) with check (auth.uid() = stylist_id);

-- ============================================================
-- Recurring weekly availability windows
-- ============================================================
create table if not exists public.stylist_availability (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440),
  check (end_min > start_min)
);

create index if not exists stylist_availability_idx on public.stylist_availability (stylist_id, weekday);

alter table public.stylist_availability enable row level security;

drop policy if exists "read availability" on public.stylist_availability;
create policy "read availability" on public.stylist_availability
  for select using (true);

drop policy if exists "manage own availability" on public.stylist_availability;
create policy "manage own availability" on public.stylist_availability
  for all using (auth.uid() = stylist_id) with check (auth.uid() = stylist_id);

-- ============================================================
-- Bookings
-- ============================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  starts_at timestamptz not null,
  duration_minutes int not null default 60,
  status text not null default 'pending',  -- pending | confirmed | declined | cancelled | completed
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists bookings_stylist_idx on public.bookings (stylist_id, starts_at);
create index if not exists bookings_client_idx on public.bookings (client_id, starts_at);

-- Prevent two active bookings for the same stylist at the same start time.
create unique index if not exists bookings_no_double_book
  on public.bookings (stylist_id, starts_at)
  where status in ('pending', 'confirmed');

alter table public.bookings enable row level security;

drop policy if exists "read own bookings" on public.bookings;
create policy "read own bookings" on public.bookings
  for select using (auth.uid() = client_id or auth.uid() = stylist_id);

drop policy if exists "create bookings" on public.bookings;
create policy "create bookings" on public.bookings
  for insert with check (auth.uid() = client_id);

drop policy if exists "update own bookings" on public.bookings;
create policy "update own bookings" on public.bookings
  for update using (auth.uid() = client_id or auth.uid() = stylist_id)
  with check (auth.uid() = client_id or auth.uid() = stylist_id);

-- ============================================================
-- Stylist directory (privacy-safe list of bookable stylists)
-- ============================================================
create or replace function public.list_stylists(q text default null)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  privacy text,
  is_stylist boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.privacy, p.is_stylist
  from public.profiles p
  where p.is_stylist = true
    and p.username is not null
    and (
      q is null or length(q) < 2
      or p.username ilike '%' || q || '%'
      or p.display_name ilike '%' || q || '%'
    )
  order by p.display_name nulls last
  limit 100;
$$;

grant execute on function public.list_stylists(text) to anon, authenticated;

-- ============================================================
-- Notifications for booking lifecycle
-- ============================================================
create or replace function public.notify_booking_requested()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.wants_notifications(new.stylist_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (new.stylist_id, new.client_id, 'booking_requested', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_booking_requested on public.bookings;
create trigger trg_notify_booking_requested
  after insert on public.bookings
  for each row execute function public.notify_booking_requested();

create or replace function public.notify_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  ntype text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'confirmed' then
    recipient := new.client_id; ntype := 'booking_confirmed';
  elsif new.status = 'declined' then
    recipient := new.client_id; ntype := 'booking_declined';
  elsif new.status = 'cancelled' then
    -- notify whichever party did not perform the cancel
    recipient := case when auth.uid() = new.client_id then new.stylist_id else new.client_id end;
    ntype := 'booking_cancelled';
  else
    return new;
  end if;

  if recipient is not null and recipient <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000')
     and public.wants_notifications(recipient) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (recipient, coalesce(auth.uid(), new.stylist_id), ntype, new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_booking_status on public.bookings;
create trigger trg_notify_booking_status
  after update on public.bookings
  for each row execute function public.notify_booking_status();

-- ============================================================
-- Realtime
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
