-- Sif: stylist reviews & ratings.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings.sql and notifications.sql.
--
-- Model:
--   stylist_reviews : one rating (1–5) + optional text per completed booking,
--                     written by the client, readable by everyone.
-- A stylist's overall rating is the average of their reviews.

-- ============================================================
-- Reviews
-- ============================================================
create table if not exists public.stylist_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  stylist_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  rating smallint not null check (rating between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stylist_reviews_stylist_idx on public.stylist_reviews (stylist_id, created_at desc);

alter table public.stylist_reviews enable row level security;

-- Anyone can read reviews (they're public on a stylist's profile).
drop policy if exists "read reviews" on public.stylist_reviews;
create policy "read reviews" on public.stylist_reviews
  for select using (true);

-- Clients may review only their own completed bookings with that stylist.
drop policy if exists "create own review" on public.stylist_reviews;
create policy "create own review" on public.stylist_reviews
  for insert with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.client_id = auth.uid()
        and b.stylist_id = stylist_reviews.stylist_id
        and b.status = 'completed'
    )
  );

drop policy if exists "update own review" on public.stylist_reviews;
create policy "update own review" on public.stylist_reviews
  for update using (auth.uid() = client_id) with check (auth.uid() = client_id);

drop policy if exists "delete own review" on public.stylist_reviews;
create policy "delete own review" on public.stylist_reviews
  for delete using (auth.uid() = client_id);

-- ============================================================
-- Notify the stylist when they receive a review
-- ============================================================
create or replace function public.notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stylist_id <> new.client_id and public.wants_notifications(new.stylist_id) then
    insert into public.notifications (user_id, actor_id, type, entity_id)
    values (new.stylist_id, new.client_id, 'review_received', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_review on public.stylist_reviews;
create trigger trg_notify_review
  after insert on public.stylist_reviews
  for each row execute function public.notify_review();

-- ============================================================
-- Stylist directory, now with aggregated rating.
-- Return signature changes, so the old function must be dropped first.
-- ============================================================
drop function if exists public.list_stylists(text);
create function public.list_stylists(q text default null)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  privacy text,
  is_stylist boolean,
  rating_avg numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.username, p.display_name, p.avatar_url, p.bio, p.privacy, p.is_stylist,
    coalesce(r.avg_rating, 0)::numeric(3, 2) as rating_avg,
    coalesce(r.cnt, 0)::bigint as rating_count
  from public.profiles p
  left join (
    select stylist_id, avg(rating) as avg_rating, count(*) as cnt
    from public.stylist_reviews
    group by stylist_id
  ) r on r.stylist_id = p.id
  where p.is_stylist = true
    and p.username is not null
    and (
      q is null or length(q) < 2
      or p.username ilike '%' || q || '%'
      or p.display_name ilike '%' || q || '%'
    )
  order by rating_count desc, p.display_name nulls last
  limit 100;
$$;

grant execute on function public.list_stylists(text) to anon, authenticated;
