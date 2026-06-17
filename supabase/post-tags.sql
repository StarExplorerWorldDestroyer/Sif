-- Sif: tag a stylist in a post.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER posts.sql, social.sql, and notifications.sql.
--
-- A post can credit/tag a stylist (any Sif user). Reads are already covered by
-- the existing posts RLS; the owner sets stylist_id under the "own posts" /
-- insert-with-check policies. When a post tags a stylist, the stylist gets an
-- in-app notification (respecting their notifications toggle).

alter table public.posts
  add column if not exists stylist_id uuid references auth.users (id) on delete set null;

create or replace function public.notify_post_tag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stylist_id is not null
     and new.stylist_id <> new.user_id
     and (tg_op = 'INSERT' or old.stylist_id is distinct from new.stylist_id)
     and public.wants_notifications(new.stylist_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (new.stylist_id, new.user_id, 'post_tag', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_post_tag on public.posts;
create trigger trg_notify_post_tag
  after insert or update on public.posts
  for each row execute function public.notify_post_tag();
