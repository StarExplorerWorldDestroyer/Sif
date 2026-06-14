-- Sif profiles + preferences
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  username text unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text not null default '',

  -- preferences
  currency text not null default 'USD',
  units text not null default 'in',
  profile_public boolean not null default false,
  notifications_enabled boolean not null default true
);

alter table public.profiles enable row level security;

-- Anyone can read a profile that's public; you can always read your own.
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select using (profile_public = true or auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Avatar storage bucket (public read, owner write)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "owner upload avatars" on storage.objects;
create policy "owner upload avatars" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner update avatars" on storage.objects;
create policy "owner update avatars" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
