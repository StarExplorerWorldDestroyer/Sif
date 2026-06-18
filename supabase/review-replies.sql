-- Sif: stylist replies to reviews.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER reviews.sql.
--
-- A stylist can post (and edit) a single public reply to each review they
-- receive. Writes go through set_review_reply() so the stylist can only touch
-- the reply text — never the rating/body the client wrote.

alter table public.stylist_reviews
  add column if not exists reply text not null default '',
  add column if not exists reply_at timestamptz;

-- ============================================================
-- Stylist sets / clears their reply to one of their reviews.
-- ============================================================
create or replace function public.set_review_reply(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text := trim(coalesce(p_reply, ''));
begin
  update public.stylist_reviews
    set reply = trimmed,
        reply_at = case when length(trimmed) > 0 then now() else null end
  where id = p_review_id
    and stylist_id = auth.uid();
end; $$;

grant execute on function public.set_review_reply(uuid, text) to authenticated;

-- ============================================================
-- Notify the client when the stylist replies.
-- ============================================================
create or replace function public.notify_review_reply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reply is distinct from old.reply
     and length(trim(coalesce(new.reply, ''))) > 0
     and new.client_id <> new.stylist_id
     and public.wants_notifications(new.client_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (new.client_id, new.stylist_id, 'review_reply', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_review_reply on public.stylist_reviews;
create trigger trg_notify_review_reply
  after update on public.stylist_reviews
  for each row execute function public.notify_review_reply();
