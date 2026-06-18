-- Sif: booking polish — cancellation reasons + reschedule notifications.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings.sql.

alter table public.bookings
  add column if not exists cancel_reason text not null default '';

-- Notify on reschedule (time change) as well as status transitions.
create or replace function public.notify_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  ntype text;
  me uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000');
begin
  -- A changed start time means the booking was rescheduled.
  if new.starts_at is distinct from old.starts_at then
    recipient := case when me = new.client_id then new.stylist_id else new.client_id end;
    if recipient is not null and recipient <> me and public.wants_notifications(recipient) then
      insert into public.notifications (user_id, actor_id, type, entity_id)
      values (recipient, me, 'booking_rescheduled', new.id);
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'confirmed' then
    recipient := new.client_id; ntype := 'booking_confirmed';
  elsif new.status = 'declined' then
    recipient := new.client_id; ntype := 'booking_declined';
  elsif new.status = 'cancelled' then
    recipient := case when me = new.client_id then new.stylist_id else new.client_id end;
    ntype := 'booking_cancelled';
  else
    return new;
  end if;

  if recipient is not null and recipient <> me and public.wants_notifications(recipient) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (recipient, me, ntype, new.id);
  end if;
  return new;
end; $$;
