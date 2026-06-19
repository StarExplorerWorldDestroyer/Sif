-- Sif: messaging depth — photo messages + new-message notifications.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER messages.sql and notifications.sql.

-- ============================================================
-- 1. Photo attachments on messages
-- ============================================================
alter table public.messages
  add column if not exists image_url text;

-- A message can now be image-only, so the body may be empty.
alter table public.messages
  alter column body set default '';

-- Storage bucket for message photos (public read, owner write).
insert into storage.buckets (id, name, public)
values ('message-photos', 'message-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read message photos" on storage.objects;
create policy "public read message photos" on storage.objects
  for select using (bucket_id = 'message-photos');

drop policy if exists "owner upload message photos" on storage.objects;
create policy "owner upload message photos" on storage.objects
  for insert with check (
    bucket_id = 'message-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner update message photos" on storage.objects;
create policy "owner update message photos" on storage.objects
  for update using (
    bucket_id = 'message-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 2. Inbox preview is photo-aware (image-only messages show "Photo").
-- ============================================================
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message = case
          when coalesce(new.body, '') <> '' then left(new.body, 200)
          when new.image_url is not null then 'Photo'
          else ''
        end,
        last_message_at = new.created_at,
        last_sender = new.sender_id
  where id = new.conversation_id;
  return new;
end; $$;

-- ============================================================
-- 3. Notify the recipient of a new message.
--    Deduped per conversation: each conversation keeps exactly one
--    'message' notification, refreshed (and re-flagged unread) on every
--    new message, so the bell shows "X messaged you" once per thread
--    instead of one row per message.
-- ============================================================
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into recipient
  from public.conversations c
  where c.id = new.conversation_id;

  if recipient is null or recipient = new.sender_id then
    return new;
  end if;

  if not public.wants_notifications(recipient) then
    return new;
  end if;

  update public.notifications
     set actor_id = new.sender_id,
         created_at = new.created_at,
         read = false
   where user_id = recipient
     and type = 'message'
     and entity_id = new.conversation_id;

  if not found then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (recipient, new.sender_id, 'message', new.conversation_id);
  end if;

  return new;
end; $$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message
  after insert on public.messages
  for each row execute function public.notify_message();

-- ============================================================
-- 4. Realtime already includes public.messages from messages.sql.
--    Ensure notifications stream UPDATEs too (the dedupe above updates an
--    existing row rather than inserting). No-op if already present.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
