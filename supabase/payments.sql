-- Sif: stylist services, deposits, buffers, and booking payments.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings.sql and dashboard.sql.
--
-- Adds:
--   stylist_services            : a stylist's menu (name, price, duration, buffers)
--   stylist_booking_settings.*  : deposit policy + default buffers
--   bookings.*                  : service link, deposit, amount paid, payment status, buffers
--   payments                    : individual transactions against a booking
-- Money is stored in whole currency units (numeric), matching the rest of the app.

-- ============================================================
-- Service menu
-- ============================================================
create table if not exists public.stylist_services (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  description text not null default '',
  duration_minutes int not null default 60 check (duration_minutes between 5 and 600),
  price numeric(10, 2) not null default 0 check (price >= 0),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes between 0 and 240),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists stylist_services_idx on public.stylist_services (stylist_id, sort_order);

alter table public.stylist_services enable row level security;

drop policy if exists "read services" on public.stylist_services;
create policy "read services" on public.stylist_services
  for select using (true);

drop policy if exists "manage own services" on public.stylist_services;
create policy "manage own services" on public.stylist_services
  for all using (auth.uid() = stylist_id) with check (auth.uid() = stylist_id);

-- ============================================================
-- Deposit policy + default buffers on booking settings
-- ============================================================
alter table public.stylist_booking_settings
  add column if not exists deposit_enabled boolean not null default false,
  add column if not exists deposit_type text not null default 'percent'
    check (deposit_type in ('percent', 'flat')),
  add column if not exists deposit_value numeric(10, 2) not null default 0 check (deposit_value >= 0),
  add column if not exists buffer_before_minutes int not null default 0 check (buffer_before_minutes between 0 and 240),
  add column if not exists buffer_after_minutes int not null default 0 check (buffer_after_minutes between 0 and 240);

-- ============================================================
-- Booking: service link, deposit, payment tracking, buffers
-- ============================================================
alter table public.bookings
  add column if not exists service_id uuid references public.stylist_services (id) on delete set null,
  add column if not exists deposit_amount numeric(10, 2) not null default 0 check (deposit_amount >= 0),
  add column if not exists amount_paid numeric(10, 2) not null default 0 check (amount_paid >= 0),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'deposit_paid', 'paid', 'refunded')),
  add column if not exists buffer_before_minutes int not null default 0,
  add column if not exists buffer_after_minutes int not null default 0;

-- Replace the exact-start guard with an overlap guard that respects buffers, so
-- the next client can't book inside a stylist's prep/cleanup window.
--
-- `timestamptz +/- interval` is only STABLE (it depends on the session time
-- zone), so it can't appear directly in an index expression. Instead we store
-- the precomputed blocked range in a column (maintained by a trigger) and index
-- that plain range column, which is immutable.
create extension if not exists btree_gist;
drop index if exists public.bookings_no_double_book;

alter table public.bookings
  add column if not exists blocked tstzrange;

create or replace function public.set_booking_blocked()
returns trigger language plpgsql as $$
begin
  new.blocked := tstzrange(
    new.starts_at - make_interval(mins => new.buffer_before_minutes),
    new.starts_at + make_interval(mins => new.duration_minutes + new.buffer_after_minutes)
  );
  return new;
end; $$;

drop trigger if exists trg_set_booking_blocked on public.bookings;
create trigger trg_set_booking_blocked
  before insert or update of starts_at, duration_minutes, buffer_before_minutes, buffer_after_minutes
  on public.bookings
  for each row execute function public.set_booking_blocked();

-- Backfill existing rows so the constraint can be created.
update public.bookings
set blocked = tstzrange(
  starts_at - make_interval(mins => buffer_before_minutes),
  starts_at + make_interval(mins => duration_minutes + buffer_after_minutes)
)
where blocked is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap'
  ) then
    alter table public.bookings add constraint bookings_no_overlap exclude using gist (
      stylist_id with =,
      blocked with &&
    ) where (status in ('pending', 'confirmed'));
  end if;
end $$;

-- ============================================================
-- Payments
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  payer_id uuid not null references auth.users (id) on delete cascade,
  payee_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  kind text not null default 'full' check (kind in ('deposit', 'balance', 'full')),
  method text not null default 'app' check (method in ('app', 'cash', 'other')),
  status text not null default 'succeeded' check (status in ('succeeded', 'pending', 'failed', 'refunded')),
  provider text not null default 'mock',
  provider_ref text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments (booking_id);

alter table public.payments enable row level security;

-- Either party to the booking can see its payments.
drop policy if exists "read booking payments" on public.payments;
create policy "read booking payments" on public.payments
  for select using (auth.uid() = payer_id or auth.uid() = payee_id);

-- The payer (client paying) or the payee (stylist recording a cash payment) may
-- insert. With a mock provider this is fine; the real Stripe path will insert
-- via an edge function using the service role + webhooks.
drop policy if exists "create booking payments" on public.payments;
create policy "create booking payments" on public.payments
  for insert with check (auth.uid() = payer_id or auth.uid() = payee_id);

drop policy if exists "update booking payments" on public.payments;
create policy "update booking payments" on public.payments
  for update using (auth.uid() = payee_id) with check (auth.uid() = payee_id);

-- ============================================================
-- Keep bookings.amount_paid / payment_status in sync with payments
-- ============================================================
create or replace function public.recompute_booking_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bid uuid := coalesce(new.booking_id, old.booking_id);
  total numeric(10, 2);
  bk record;
  new_status text;
begin
  select coalesce(sum(amount), 0) into total
  from public.payments
  where booking_id = bid and status = 'succeeded';

  select price, deposit_amount into bk from public.bookings where id = bid;

  if total <= 0 then
    new_status := 'unpaid';
  elsif bk.price > 0 and total >= bk.price then
    new_status := 'paid';
  else
    new_status := 'deposit_paid';
  end if;

  update public.bookings
  set amount_paid = total, payment_status = new_status
  where id = bid;

  return null;
end; $$;

drop trigger if exists trg_recompute_booking_payment on public.payments;
create trigger trg_recompute_booking_payment
  after insert or update or delete on public.payments
  for each row execute function public.recompute_booking_payment();

-- ============================================================
-- Realtime
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;
