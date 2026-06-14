-- Seaf database schema
-- Paste this into the Supabase SQL Editor (https://supabase.com → your project → SQL Editor)
-- and click "Run". Safe to re-run.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.haircuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),

  date date not null,
  cut_type text not null default 'Haircut',
  location text not null default '',

  price numeric not null default 0,
  tip numeric not null default 0,

  likes integer not null default 0,
  comments integer not null default 0,
  liked boolean not null default false,
  bookmarked boolean not null default false,

  length_top text not null default '',
  length_sides text not null default '',
  length_back text not null default '',
  techniques text[] not null default '{}',
  tools text[] not null default '{}',

  public_notes text not null default '',
  private_notes text not null default '',
  stylist_notes text not null default '',

  -- Stylist details kept together as JSON for flexibility.
  stylist jsonb not null default '{}'::jsonb
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  haircut_id uuid not null references public.haircuts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),

  uri text not null,          -- public URL of the file in storage
  angle text not null default 'front',
  note text not null default '',
  position integer not null default 0
);

create index if not exists haircuts_user_id_idx on public.haircuts (user_id);
create index if not exists photos_haircut_id_idx on public.photos (haircut_id);

-- ============================================================
-- Row-Level Security: each user can only touch their own rows
-- ============================================================

alter table public.haircuts enable row level security;
alter table public.photos enable row level security;

drop policy if exists "own haircuts" on public.haircuts;
create policy "own haircuts" on public.haircuts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own photos" on public.photos;
create policy "own photos" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for haircut photos (public read, owner write)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('haircut-photos', 'haircut-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read haircut photos" on storage.objects;
create policy "public read haircut photos" on storage.objects
  for select using (bucket_id = 'haircut-photos');

drop policy if exists "owner upload haircut photos" on storage.objects;
create policy "owner upload haircut photos" on storage.objects
  for insert with check (
    bucket_id = 'haircut-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner delete haircut photos" on storage.objects;
create policy "owner delete haircut photos" on storage.objects
  for delete using (
    bucket_id = 'haircut-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
