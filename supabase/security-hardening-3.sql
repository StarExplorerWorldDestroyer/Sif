-- Sif: pre-launch hardening (Phase 5).
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER security-hardening.sql, security-hardening-2.sql, and messages-depth.sql.
--
-- Closes three residual gaps found in the final pre-launch audit:
--   1. Mock/manual payments could be recorded against a cancelled or declined
--      booking. They now only apply to live bookings (pending/confirmed/completed).
--   2. is_connected() was executable by anonymous callers, allowing relationship
--      probing between arbitrary user ids. Now authenticated-only.
--   3. DM photo UPLOADs only checked that the first path segment was the caller's
--      id; they now also require membership in the target conversation (reads were
--      already participant-scoped in Phase 2b).

-- ============================================================
-- 1. Payments only on live bookings
-- ============================================================
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
  if bk.status not in ('pending', 'confirmed', 'completed') then
    raise exception 'This booking is not open for payment';
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
  if bk.status not in ('pending', 'confirmed', 'completed') then
    raise exception 'This booking is not open for payment';
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
-- 2. No anonymous relationship probing
-- ============================================================
revoke execute on function public.is_connected(uuid, uuid) from anon;

-- ============================================================
-- 3. DM photo uploads scoped to conversation participants
--    Object paths are `{uid}/{conversationId}/{file}` (see lib/photos.ts).
-- ============================================================
drop policy if exists "owner upload message photos" on storage.objects;
drop policy if exists "participants upload message photos" on storage.objects;
create policy "participants upload message photos" on storage.objects
  for insert with check (
    bucket_id = 'message-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.conversations c
      where c.id = ((storage.foldername(name))[2])::uuid
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

drop policy if exists "owner update message photos" on storage.objects;
drop policy if exists "participants update message photos" on storage.objects;
create policy "participants update message photos" on storage.objects
  for update using (
    bucket_id = 'message-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.conversations c
      where c.id = ((storage.foldername(name))[2])::uuid
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
