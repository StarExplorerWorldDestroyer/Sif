-- Sif: threaded replies on comments.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER engagement.sql.

-- One level of threading: a comment may point at a parent comment.
alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments (id) on delete cascade;

create index if not exists post_comments_parent_idx on public.post_comments (parent_id);

-- Notify on comments AND replies:
--  - top-level comment  -> notify the post owner          ('post_comment')
--  - reply to a comment -> notify the parent comment author ('comment_reply')
-- Self-actions are skipped and the recipient's notifications toggle is respected.
create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  parent_author uuid;
begin
  if new.parent_id is null then
    select user_id into owner_id from public.posts where id = new.post_id;
    if owner_id is not null
       and owner_id <> new.user_id
       and public.wants_notifications(owner_id) then
      insert into public.notifications (user_id, actor_id, type, entity_id)
      values (owner_id, new.user_id, 'post_comment', new.post_id);
    end if;
  else
    select user_id into parent_author from public.post_comments where id = new.parent_id;
    if parent_author is not null
       and parent_author <> new.user_id
       and public.wants_notifications(parent_author) then
      insert into public.notifications (user_id, actor_id, type, entity_id)
      values (parent_author, new.user_id, 'comment_reply', new.post_id);
    end if;
  end if;
  return new;
end; $$;
