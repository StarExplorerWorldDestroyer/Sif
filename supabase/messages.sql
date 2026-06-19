-- Sif: direct messaging (1:1 conversations between any two users).
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER profiles.sql / public-profiles.sql.
--
-- Model:
--   conversations : one row per unordered pair of users (user_a < user_b),
--                   with denormalized last-message fields for the inbox.
--   messages      : individual messages in a conversation.

-- ============================================================
-- Conversations
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message text not null default '',
  last_message_at timestamptz,
  last_sender uuid,
  check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.conversations enable row level security;

drop policy if exists "read conversations" on public.conversations;
create policy "read conversations" on public.conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "create conversations" on public.conversations;
create policy "create conversations" on public.conversations
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

-- ============================================================
-- Messages
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

-- A participant of the conversation can read its messages.
drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

-- Only a participant may send, and only as themselves.
drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

-- Participants may update messages (used to mark the other party's as read).
drop policy if exists "update messages" on public.messages;
create policy "update messages" on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  ) with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

-- ============================================================
-- Keep conversation's last-message fields fresh.
-- ============================================================
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message = left(new.body, 200),
        last_message_at = new.created_at,
        last_sender = new.sender_id
  where id = new.conversation_id;
  return new;
end; $$;

drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ============================================================
-- Get (or lazily create) the conversation between me and another user.
-- ============================================================
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
  a := least(me, other);
  b := greatest(me, other);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.conversations (user_a, user_b) values (a, b) returning id into cid;
  end if;
  return cid;
end; $$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ============================================================
-- Inbox: my conversations with the other party + unread count.
-- ============================================================
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
  order by c.last_message_at desc;
$$;

grant execute on function public.list_conversations() to authenticated;

-- ============================================================
-- Realtime
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
