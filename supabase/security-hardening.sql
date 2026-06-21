-- Sif: pre-launch security hardening (Phases 1 & 2).
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER payments.sql, bookings.sql, messages-depth.sql.
--
-- Closes the gaps where the CLIENT could bypass the server:
--   1. Payments are no longer client-writable. Money is recorded only by the
--      Stripe webhook (service role) or two validated SECURITY DEFINER RPCs
--      (mock in-app payment by the client; manual cash/other by the stylist).
--      The server computes the amount — the client can never name its own price.
--   2. Booking price/deposit/payment fields are server-authoritative (a trigger
--      sets them from the stylist's service + deposit policy on insert), and
--      booking status transitions are role-scoped (only the stylist can confirm/
--      decline/complete; the client can only cancel or reschedule). Money columns
--      are not directly client-writable.
--   3. DM photos move to a private bucket readable only by conversation
--      participants (served via short-lived signed URLs), and messages can only
--      be updated to set read_at — no editing body/sender after the fact.

-- ============================================================
-- PHASE 1a — Payments: remove client write access
-- ============================================================
-- SELECT (either party) stays. Drop the client INSERT/UPDATE policies: with RLS
-- enabled and no permissive write policy, authenticated clients can no longer
-- write payments directly. The webhook (service role) and the SECURITY DEFINER
-- RPCs below (run as owner) bypass RLS and remain able to insert.
drop policy if exists "create booking payments" on public.payments;
drop policy if exists "update booking payments" on public.payments;

-- In-app (mock) payment by the client. The amount is derived from the booking,
-- never supplied by the caller. Used when PAYMENTS_PROVIDER = 'mock'.
create or replace function public.pay_booking_mock(p_booking_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bk record;
  due numeric(10, 2);
begin
  if p_kind not in ('deposit', 'balance', 'full') then
    raise exception 'Invalid payment kind';
  end if;
  select * into bk from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  if auth.uid() is distinct from bk.client_id then
    raise exception 'Only the client can pay for this booking';
  end if;

  if p_kind = 'deposit' then
    due := round(greatest(0, bk.deposit_amount - bk.amount_paid), 2);
  else
    due := round(greatest(0, bk.price - bk.amount_paid), 2);
  end if;
  if due <= 0 then raise exception 'Nothing left to pay on this booking'; end if;

  insert into public.payments
    (booking_id, payer_id, payee_id, amount, currency, kind, method, status, provider, provider_ref)
  values
    (bk.id, bk.client_id, bk.stylist_id, due,
     coalesce((select currency from public.profiles where id = bk.client_id), 'USD'),
     p_kind, 'app', 'succeeded', 'mock', '');
end; $$;

grant execute on function public.pay_booking_mock(uuid, text) to authenticated;

-- Manual (cash/other) payment recorded by the stylist for the remaining balance.
create or replace function public.record_manual_payment(p_booking_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bk record;
  due numeric(10, 2);
  k text;
begin
  if p_method not in ('cash', 'other') then
    raise exception 'Invalid payment method';
  end if;
  select * into bk from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  if auth.uid() is distinct from bk.stylist_id then
    raise exception 'Only the stylist can record a manual payment';
  end if;

  due := round(greatest(0, bk.price - bk.amount_paid), 2);
  if due <= 0 then raise exception 'This booking is already fully paid'; end if;
  k := case when bk.amount_paid > 0 then 'balance' else 'full' end;

  insert into public.payments
    (booking_id, payer_id, payee_id, amount, currency, kind, method, status, provider, provider_ref)
  values
    (bk.id, bk.client_id, bk.stylist_id, due,
     coalesce((select currency from public.profiles where id = bk.client_id), 'USD'),
     k, p_method, 'succeeded', 'manual', '');
end; $$;

grant execute on function public.record_manual_payment(uuid, text) to authenticated;

-- ============================================================
-- PHASE 1b — Bookings: server-authoritative pricing + role-scoped status
-- ============================================================
-- On insert, compute price/duration/buffers/deposit from the stylist's service
-- and deposit policy, ignoring whatever the client sent. amount_paid and
-- payment_status are always reset to 0/'unpaid'. Runs SECURITY DEFINER so it can
-- read the stylist's settings regardless of the caller.
create or replace function public.set_booking_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
  st record;
  dep numeric(10, 2) := 0;
begin
  select deposit_enabled, deposit_type, deposit_value,
         buffer_before_minutes, buffer_after_minutes
    into st
  from public.stylist_booking_settings
  where stylist_id = new.stylist_id;

  if new.service_id is not null then
    select * into svc from public.stylist_services
    where id = new.service_id and stylist_id = new.stylist_id and active = true;
    if found then
      new.price := svc.price;
      new.duration_minutes := svc.duration_minutes;
      new.buffer_before_minutes := case when svc.buffer_before_minutes > 0
        then svc.buffer_before_minutes else coalesce(st.buffer_before_minutes, 0) end;
      new.buffer_after_minutes := case when svc.buffer_after_minutes > 0
        then svc.buffer_after_minutes else coalesce(st.buffer_after_minutes, 0) end;
    else
      -- Unknown service or one that isn't this stylist's: ignore it.
      new.service_id := null;
      new.price := 0;
      new.buffer_before_minutes := coalesce(st.buffer_before_minutes, 0);
      new.buffer_after_minutes := coalesce(st.buffer_after_minutes, 0);
    end if;
  else
    new.price := 0;
    new.buffer_before_minutes := coalesce(st.buffer_before_minutes, 0);
    new.buffer_after_minutes := coalesce(st.buffer_after_minutes, 0);
  end if;

  if coalesce(st.deposit_enabled, false) and new.price > 0 then
    if st.deposit_type = 'percent' then
      dep := round(new.price * st.deposit_value / 100.0, 2);
    else
      dep := st.deposit_value;
    end if;
    dep := greatest(0, least(dep, new.price));
  else
    dep := 0;
  end if;

  new.deposit_amount := dep;
  new.amount_paid := 0;
  new.payment_status := 'unpaid';
  return new;
end; $$;

-- Name sorts before trg_set_booking_blocked so the blocked range is computed
-- from the authoritative duration/buffers this trigger sets.
drop trigger if exists trg_booking_pricing on public.bookings;
create trigger trg_booking_pricing
  before insert on public.bookings
  for each row execute function public.set_booking_pricing();

-- Role-scoped status transitions. Service role / cron (no auth.uid()) bypass.
create or replace function public.guard_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return new;
  end if;
  if new.status is distinct from old.status then
    if uid = old.stylist_id then
      if new.status not in ('pending', 'confirmed', 'declined', 'completed', 'cancelled') then
        raise exception 'Invalid booking status: %', new.status;
      end if;
    elsif uid = old.client_id then
      if new.status not in ('cancelled', 'pending') then
        raise exception 'Clients cannot set booking status to %', new.status;
      end if;
    else
      raise exception 'Not a party to this booking';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_booking_status on public.bookings;
create trigger trg_guard_booking_status
  before update on public.bookings
  for each row execute function public.guard_booking_status();

-- Money columns are not directly client-writable. Replace the table-wide UPDATE
-- grant with column-level grants for the fields clients/stylists legitimately
-- change. The recompute/price RPCs run as owner and are unaffected.
revoke update on public.bookings from authenticated;
grant update (status, starts_at, note, cancel_reason) on public.bookings to authenticated;

-- Stylist sets what they charged (replaces a direct client UPDATE of price).
create or replace function public.set_booking_price(p_booking_id uuid, p_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bk record;
begin
  if p_price is null or p_price < 0 then raise exception 'Invalid price'; end if;
  select id, stylist_id, amount_paid into bk from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  if auth.uid() is distinct from bk.stylist_id then
    raise exception 'Only the stylist can set the price';
  end if;

  update public.bookings
  set price = p_price,
      payment_status = case
        when bk.amount_paid <= 0 then 'unpaid'
        when p_price > 0 and bk.amount_paid >= p_price then 'paid'
        else 'deposit_paid'
      end
  where id = p_booking_id;
end; $$;

grant execute on function public.set_booking_price(uuid, numeric) to authenticated;

-- ============================================================
-- PHASE 2a — Messages: restrict UPDATE to read_at only
-- ============================================================
-- The participant RLS policy still controls WHICH rows are visible/updatable;
-- column grants control WHICH columns may change. This makes "mark as read" work
-- while preventing tampering with body / sender_id / image_url / created_at.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- ============================================================
-- PHASE 2b — DM photos: private bucket, participant-only read
-- ============================================================
update storage.buckets set public = false where id = 'message-photos';

-- Replace the public-read policy with one scoped to conversation participants.
-- Object paths are `{uid}/{conversationId}/{file}`, so foldername()[2] is the
-- conversation id; access requires membership in that conversation.
drop policy if exists "public read message photos" on storage.objects;
drop policy if exists "participants read message photos" on storage.objects;
create policy "participants read message photos" on storage.objects
  for select using (
    bucket_id = 'message-photos'
    and exists (
      select 1 from public.conversations c
      where c.id = ((storage.foldername(name))[2])::uuid
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
