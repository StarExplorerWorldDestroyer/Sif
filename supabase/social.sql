-- Sif: social graph, privacy, stylist roles, photo-update timelines,
-- per-post visibility, and stylist-created pending cuts.
--
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER schema.sql, profiles.sql, posts.sql, and public-profiles.sql.

-- ============================================================
-- Profiles: privacy tiers + stylist flag
-- ============================================================

-- privacy: 'public' | 'connections' | 'private'
-- Backfill from the old boolean so existing visibility is preserved:
--   profile_public = true  -> 'public'
--   profile_public = false -> 'private'
alter table public.profiles add column if not exists privacy text;
update public.profiles
  set privacy = case when profile_public then 'public' else 'private' end
  where privacy is null;
alter table public.profiles alter column privacy set default 'public';
alter table public.profiles alter column privacy set not null;

alter table public.profiles add column if not exists is_stylist boolean not null default false;

-- ============================================================
-- Connection check helper (used by RLS on profiles & posts).
-- SECURITY DEFINER so it can see the connections table regardless of
-- the calling user's own RLS.
-- ============================================================

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'accepted'
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists connections_addressee_idx on public.connections (addressee_id);
create index if not exists connections_requester_idx on public.connections (requester_id);

create or replace function public.is_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = a and c.addressee_id = b)
        or (c.requester_id = b and c.addressee_id = a)
      )
  );
$$;

alter table public.connections enable row level security;

-- Only the two parties can see a connection row.
drop policy if exists "read connections" on public.connections;
create policy "read connections" on public.connections
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "request connection" on public.connections;
create policy "request connection" on public.connections
  for insert with check (auth.uid() = requester_id and requester_id <> addressee_id);

-- The addressee can accept (update status); either party can delete (cancel/remove).
drop policy if exists "respond connection" on public.connections;
create policy "respond connection" on public.connections
  for update using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);

drop policy if exists "remove connection" on public.connections;
create policy "remove connection" on public.connections
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ============================================================
-- Follows (one-way). Who-follows-whom is treated as public info.
-- ============================================================

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "read follows" on public.follows;
create policy "read follows" on public.follows for select using (true);

drop policy if exists "follow" on public.follows;
create policy "follow" on public.follows
  for insert with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "unfollow" on public.follows;
create policy "unfollow" on public.follows
  for delete using (auth.uid() = follower_id);

-- ============================================================
-- Profiles RLS: public to all, connections-only to connections, self always.
-- ============================================================

drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select using (
    auth.uid() = id
    or privacy = 'public'
    or (privacy = 'connections' and public.is_connected(auth.uid(), id))
  );

-- Minimal, privacy-safe lookups so users can still FIND and request to connect
-- with private accounts (returns only non-sensitive fields).
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
  limit 1;
$$;

-- Minimal cards for a set of user ids (used to render connection requests /
-- follower lists even when the other account is private).
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
  where p.id = any(ids);
$$;

grant execute on function public.search_profiles(text) to anon, authenticated;
grant execute on function public.profile_card(text) to anon, authenticated;
grant execute on function public.profile_cards_by_ids(uuid[]) to anon, authenticated;
grant execute on function public.is_connected(uuid, uuid) to anon, authenticated;

-- ============================================================
-- Posts: per-post visibility ('public' | 'connections' | 'private')
-- ============================================================

alter table public.posts add column if not exists visibility text not null default 'public';

drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts
  for select using (
    auth.uid() = user_id
    or (
      visibility <> 'private'
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

-- ============================================================
-- Haircuts: stylist-created pending cuts
--   created_by = who entered it; status = 'active' | 'pending'
-- ============================================================

alter table public.haircuts add column if not exists created_by uuid references auth.users (id) on delete set null;
update public.haircuts set created_by = user_id where created_by is null;
alter table public.haircuts alter column created_by set default auth.uid();

alter table public.haircuts add column if not exists status text not null default 'active';

drop policy if exists "own haircuts" on public.haircuts;
drop policy if exists "read haircuts" on public.haircuts;
drop policy if exists "insert haircuts" on public.haircuts;
drop policy if exists "update haircuts" on public.haircuts;
drop policy if exists "delete haircuts" on public.haircuts;

create policy "read haircuts" on public.haircuts
  for select using (
    auth.uid() = user_id
    or (auth.uid() = created_by and status = 'pending')
  );

create policy "insert haircuts" on public.haircuts
  for insert with check (
    (user_id = auth.uid() and created_by = auth.uid())
    or (
      created_by = auth.uid()
      and status = 'pending'
      and public.is_connected(auth.uid(), user_id)
    )
  );

create policy "update haircuts" on public.haircuts
  for update using (
    auth.uid() = user_id
    or (auth.uid() = created_by and status = 'pending')
  ) with check (
    auth.uid() = user_id
    or (auth.uid() = created_by and status = 'pending')
  );

create policy "delete haircuts" on public.haircuts
  for delete using (
    auth.uid() = user_id
    or (auth.uid() = created_by and status = 'pending')
  );

-- ============================================================
-- Photos: tie access to the parent haircut (so a client can read
-- photos a stylist uploaded, and a stylist can upload to a pending cut).
-- ============================================================

drop policy if exists "own photos" on public.photos;
drop policy if exists "read photos" on public.photos;
drop policy if exists "write photos" on public.photos;

create policy "read photos" on public.photos
  for select using (
    exists (
      select 1 from public.haircuts h
      where h.id = photos.haircut_id
        and (h.user_id = auth.uid() or (h.created_by = auth.uid() and h.status = 'pending'))
    )
  );

create policy "write photos" on public.photos
  for all using (
    exists (
      select 1 from public.haircuts h
      where h.id = photos.haircut_id
        and (h.user_id = auth.uid() or (h.created_by = auth.uid() and h.status = 'pending'))
    )
  ) with check (
    exists (
      select 1 from public.haircuts h
      where h.id = photos.haircut_id
        and (h.user_id = auth.uid() or (h.created_by = auth.uid() and h.status = 'pending'))
    )
  );

-- ============================================================
-- Haircut updates: a timeline of follow-up photos + notes (grow-out,
-- next-day look, weeks later). Owner-managed.
-- ============================================================

create table if not exists public.haircut_updates (
  id uuid primary key default gen_random_uuid(),
  haircut_id uuid not null references public.haircuts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  uri text not null,
  note text not null default '',
  taken_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists haircut_updates_haircut_idx on public.haircut_updates (haircut_id);

alter table public.haircut_updates enable row level security;

drop policy if exists "own haircut updates" on public.haircut_updates;
create policy "own haircut updates" on public.haircut_updates
  for all using (
    exists (
      select 1 from public.haircuts h
      where h.id = haircut_updates.haircut_id and h.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.haircuts h
      where h.id = haircut_updates.haircut_id and h.user_id = auth.uid()
    )
  );
