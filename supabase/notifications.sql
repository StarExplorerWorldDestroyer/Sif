-- Sif: in-app notifications.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER social.sql (it references connections, follows, haircuts, profiles).
--
-- Notifications are created server-side by triggers (SECURITY DEFINER) so they
-- fire no matter which client performs the action, and clients can never forge
-- a notification for someone else.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,   -- recipient
  actor_id uuid references auth.users (id) on delete cascade,           -- who triggered it
  type text not null,            -- 'connection_request' | 'connection_accepted' | 'follow' | 'pending_cut'
  entity_id uuid,                -- optional related row (e.g. the pending haircut)
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Recipients can only see and manage their own notifications.
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);
-- No INSERT policy: only the SECURITY DEFINER triggers below insert rows.

-- Respect the recipient's notifications toggle (defaults to on).
create or replace function public.wants_notifications(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select notifications_enabled from public.profiles where id = uid), true);
$$;

-- ============================================================
-- Triggers
-- ============================================================

create or replace function public.notify_connection_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.wants_notifications(new.addressee_id) then
    insert into public.notifications (user_id, actor_id, type)
    values (new.addressee_id, new.requester_id, 'connection_request');
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_connection_request on public.connections;
create trigger trg_notify_connection_request
  after insert on public.connections
  for each row execute function public.notify_connection_request();

create or replace function public.notify_connection_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted'
     and old.status is distinct from 'accepted'
     and public.wants_notifications(new.requester_id) then
    insert into public.notifications (user_id, actor_id, type)
    values (new.requester_id, new.addressee_id, 'connection_accepted');
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_connection_accepted on public.connections;
create trigger trg_notify_connection_accepted
  after update on public.connections
  for each row execute function public.notify_connection_accepted();

create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.wants_notifications(new.following_id) then
    insert into public.notifications (user_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow
  after insert on public.follows
  for each row execute function public.notify_follow();

create or replace function public.notify_pending_cut()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending'
     and new.created_by is distinct from new.user_id
     and public.wants_notifications(new.user_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (new.user_id, new.created_by, 'pending_cut', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_pending_cut on public.haircuts;
create trigger trg_notify_pending_cut
  after insert on public.haircuts
  for each row execute function public.notify_pending_cut();

-- ============================================================
-- Realtime: stream new notifications to the recipient's client.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
