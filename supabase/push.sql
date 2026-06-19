-- Sif: web push notifications.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER notifications.sql.
--
-- How it works:
--   1. Browsers subscribe and store a PushSubscription in push_subscriptions.
--   2. Every row written to public.notifications fires notify_push(), which
--      calls the `push` Edge Function over pg_net. The function resolves the
--      recipient's subscriptions and sends the web push (VAPID signing lives
--      in the function, which a SQL trigger can't do).
--
-- After running this, you must (see the PR description / setup steps):
--   - deploy the `push` Edge Function,
--   - set its secrets (VAPID keys + PUSH_SECRET),
--   - run the UPDATE at the bottom to store the function URL + shared secret.

create extension if not exists pg_net;

-- ============================================================
-- Browser push subscriptions (one row per browser/endpoint).
-- ============================================================
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "read own push subs" on public.push_subscriptions;
create policy "read own push subs" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own push subs" on public.push_subscriptions;
create policy "insert own push subs" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own push subs" on public.push_subscriptions;
create policy "update own push subs" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own push subs" on public.push_subscriptions;
create policy "delete own push subs" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Private config: Edge Function URL + shared secret.
-- No RLS policies => only SECURITY DEFINER functions (owned by postgres)
-- and the service role can read it. Fill it via the UPDATE at the bottom.
-- ============================================================
create table if not exists public.push_config (
  id boolean primary key default true,
  edge_url text,
  push_secret text,
  check (id)
);

alter table public.push_config enable row level security;

insert into public.push_config (id) values (true) on conflict (id) do nothing;

-- ============================================================
-- Fan-out trigger: every (re)surfaced notification → Edge Function.
-- ============================================================
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.push_config;
begin
  -- Only push for unread notifications. On UPDATE, only when the row was
  -- freshly bumped (e.g. a new message refreshing a deduped notification),
  -- never when it's just being marked read.
  if new.read is true then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  select * into cfg from public.push_config where id = true;
  if cfg.edge_url is null or cfg.push_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := cfg.edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.push_secret
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );

  return new;
end; $$;

drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push
  after insert or update on public.notifications
  for each row execute function public.notify_push();

-- ============================================================
-- One-time config. Replace <PUSH_SECRET> with the same value you set as the
-- function's PUSH_SECRET secret. The URL already points at this project.
-- ============================================================
-- update public.push_config
--   set edge_url = 'https://jnbtzrkxowvqkdlgevrp.supabase.co/functions/v1/push',
--       push_secret = '<PUSH_SECRET>'
--   where id = true;
