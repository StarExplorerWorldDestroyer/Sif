-- Sif: post engagement — likes and comments on posts.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER posts.sql / public-profiles.sql and notifications.sql.
--
-- Likes and comments are readable by anyone who can read the underlying post
-- (the `exists (... from posts ...)` subquery re-applies the posts table's own
-- RLS for the viewer). Users can only create/remove their own.

-- ============================================================
-- Likes
-- ============================================================
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_post_idx on public.post_likes (post_id);

alter table public.post_likes enable row level security;

drop policy if exists "read post likes" on public.post_likes;
create policy "read post likes" on public.post_likes
  for select using (
    exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists "like own" on public.post_likes;
create policy "like own" on public.post_likes
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists "unlike own" on public.post_likes;
create policy "unlike own" on public.post_likes
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Comments
-- ============================================================
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "read post comments" on public.post_comments;
create policy "read post comments" on public.post_comments
  for select using (
    exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists "comment own" on public.post_comments;
create policy "comment own" on public.post_comments
  for insert with check (
    auth.uid() = user_id
    and length(btrim(body)) > 0
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists "edit own comment" on public.post_comments;
create policy "edit own comment" on public.post_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own comment" on public.post_comments;
create policy "delete own comment" on public.post_comments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Notifications: tell the post owner about likes and comments.
-- (Skips self-actions and respects the recipient's notifications toggle.)
-- ============================================================
create or replace function public.notify_post_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.posts where id = new.post_id;
  if owner_id is not null
     and owner_id <> new.user_id
     and public.wants_notifications(owner_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (owner_id, new.user_id, 'post_like', new.post_id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_post_like on public.post_likes;
create trigger trg_notify_post_like
  after insert on public.post_likes
  for each row execute function public.notify_post_like();

create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.posts where id = new.post_id;
  if owner_id is not null
     and owner_id <> new.user_id
     and public.wants_notifications(owner_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (owner_id, new.user_id, 'post_comment', new.post_id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_post_comment on public.post_comments;
create trigger trg_notify_post_comment
  after insert on public.post_comments
  for each row execute function public.notify_post_comment();

-- ============================================================
-- Realtime: stream likes/comments so open posts update live.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_likes'
  ) then
    alter publication supabase_realtime add table public.post_likes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_comments'
  ) then
    alter publication supabase_realtime add table public.post_comments;
  end if;
end $$;
