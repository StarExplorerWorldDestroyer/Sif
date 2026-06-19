-- Sif: share a post into a chat.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER messages.sql, messages-depth.sql, and posts.sql.

-- ============================================================
-- 1. Attach an optional shared post to a message.
-- ============================================================
alter table public.messages
  add column if not exists post_id uuid references public.posts (id) on delete set null;

-- ============================================================
-- 2. Inbox preview understands text, photo, and shared-post messages.
-- ============================================================
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message = case
          when coalesce(new.body, '') <> '' then left(new.body, 200)
          when new.image_url is not null then 'Photo'
          when new.post_id is not null then 'Shared a post'
          else ''
        end,
        last_message_at = new.created_at,
        last_sender = new.sender_id
  where id = new.conversation_id;
  return new;
end; $$;
