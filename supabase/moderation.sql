-- Sif: user safety — blocking + content reporting.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER social.sql and messages.sql.
--
-- Blocking is MUTUAL: once either party blocks the other, neither can message
-- the other and neither sees the other's posts, profile, search results, or
-- conversation. This file adds the tables + helper, then re-creates the
-- existing posts/profiles/messages policies and RPCs with an added block gate.
-- The non-block logic below mirrors social.sql / messages.sql exactly.

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "read own blocks" on public.blocked_users;
create policy "read own blocks" on public.blocked_users
  for select using (auth.uid() = blocker_id);

drop policy if exists "create own blocks" on public.blocked_users;
create policy "create own blocks" on public.blocked_users
  for insert with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "remove own blocks" on public.blocked_users;
create policy "remove own blocks" on public.blocked_users
  for delete using (auth.uid() = blocker_id);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  target_type text not null check (target_type in ('post', 'message', 'user', 'haircut')),
  target_id uuid not null,
  target_user_id uuid references auth.users (id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists content_reports_created_idx on public.content_reports (created_at desc);

alter table public.content_reports enable row level security;

-- Reporters can file reports; nobody reads them via the API (admins use the
-- service role / dashboard). No SELECT policy = no client reads.
drop policy if exists "file reports" on public.content_reports;
create policy "file reports" on public.content_reports
  for insert with check (auth.uid() = reporter_id);

-- ============================================================
-- Mutual block check (used by RLS). SECURITY DEFINER so it can read the
-- block table regardless of the caller's own RLS. Authenticated-only to
-- prevent anonymous probing.
-- ============================================================
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function public.is_blocked(uuid, uuid) from anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ============================================================
-- Block / unblock / report RPCs
-- ============================================================
create or replace function public.block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target is null or target = auth.uid() then
    raise exception 'invalid block target';
  end if;
  insert into public.blocked_users (blocker_id, blocked_id)
  values (auth.uid(), target)
  on conflict (blocker_id, blocked_id) do nothing;
end; $$;

grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocked_users
  where blocker_id = auth.uid() and blocked_id = target;
end; $$;

grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.report_content(
  p_target_type text,
  p_target_id uuid,
  p_target_user uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target_type not in ('post', 'message', 'user', 'haircut') then
    raise exception 'invalid report target type';
  end if;
  insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason)
  values (auth.uid(), p_target_type, p_target_id, p_target_user, left(coalesce(p_reason, ''), 1000));
end; $$;

grant execute on function public.report_content(text, uuid, uuid, text) to authenticated;

-- The blocked-accounts management list. SECURITY DEFINER so it can surface the
-- people you've blocked even though every other lookup now hides them.
create or replace function public.list_blocked_users()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.blocked_users b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.list_blocked_users() to authenticated;

-- ============================================================
-- Re-create existing policies/RPCs with the block gate added.
-- ============================================================

-- profiles: self always; otherwise must not be blocked AND pass privacy.
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select using (
    auth.uid() = id
    or (
      not public.is_blocked(auth.uid(), id)
      and (
        privacy = 'public'
        or (privacy = 'connections' and public.is_connected(auth.uid(), id))
      )
    )
  );

-- posts: self always; otherwise must not be blocked AND pass visibility.
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts
  for select using (
    auth.uid() = user_id
    or (
      not public.is_blocked(auth.uid(), posts.user_id)
      and visibility <> 'private'
      and (
        (
          visibility = 'public'
          and exists (
            select 1 from public.profiles p
            where p.id = posts.user_id and p.privacy = 'public'
          )
        )
        or public.is_connected(auth.uid(), posts.user_id)
      )
    )
  );

-- messages: a participant who hasn't blocked / been blocked by the other party.
drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
        and not public.is_blocked(
          auth.uid(),
          case when c.user_a = auth.uid() then c.user_b else c.user_a end
        )
    )
  );

drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
        and not public.is_blocked(
          auth.uid(),
          case when c.user_a = auth.uid() then c.user_b else c.user_a end
        )
    )
  );

-- Lookups: exclude blocked users from search and profile cards.
create or replace function public.search_profiles(q text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  privacy text,
  is_stylist boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.privacy, p.is_stylist
  from public.profiles p
  where length(coalesce(q, '')) >= 2
    and (p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%')
    and p.id <> auth.uid()
    and not public.is_blocked(auth.uid(), p.id)
  order by p.username nulls last
  limit 30;
$$;

create or replace function public.profile_card(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  privacy text,
  is_stylist boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.privacy, p.is_stylist
  from public.profiles p
  where p.username = p_username
    and not public.is_blocked(auth.uid(), p.id)
  limit 1;
$$;

create or replace function public.profile_cards_by_ids(ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  privacy text,
  is_stylist boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.privacy, p.is_stylist
  from public.profiles p
  where p.id = any(ids)
    and not public.is_blocked(auth.uid(), p.id);
$$;

-- Conversations: can't start one with someone in a block relationship,
-- and blocked conversations drop out of the inbox.
create or replace function public.get_or_create_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  cid uuid;
begin
  if me is null or other is null or other = me then
    raise exception 'invalid conversation target';
  end if;
  if public.is_blocked(me, other) then
    raise exception 'You cannot message this user.';
  end if;
  a := least(me, other);
  b := greatest(me, other);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.conversations (user_a, user_b) values (a, b) returning id into cid;
  end if;
  return cid;
end; $$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

create or replace function public.list_conversations()
returns table (
  id uuid,
  other_id uuid,
  last_message text,
  last_message_at timestamptz,
  last_sender uuid,
  unread integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end as other_id,
    c.last_message,
    c.last_message_at,
    c.last_sender,
    (
      select count(*) from public.messages m
      where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null
    )::int as unread
  from public.conversations c
  where (auth.uid() = c.user_a or auth.uid() = c.user_b)
    and c.last_message_at is not null
    and not public.is_blocked(
      auth.uid(),
      case when c.user_a = auth.uid() then c.user_b else c.user_a end
    )
  order by c.last_message_at desc;
$$;

grant execute on function public.list_conversations() to authenticated;
