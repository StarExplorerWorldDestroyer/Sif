-- Personal inspiration library: saved reference photos + Pinterest pin/board links.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
--
-- Photos live in a PRIVATE `reference-photos` bucket (owner-scoped paths).
-- Pin/board rows store URLs only — opening them launches Pinterest (app/web).
-- Pin images the user chooses to keep are uploaded as kind='photo' with source_url.

-- ============================================================
-- 1. Private storage bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('reference-photos', 'reference-photos', false)
on conflict (id) do nothing;

drop policy if exists "owner read reference photos" on storage.objects;
create policy "owner read reference photos" on storage.objects
  for select using (
    bucket_id = 'reference-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner upload reference photos" on storage.objects;
create policy "owner upload reference photos" on storage.objects
  for insert with check (
    bucket_id = 'reference-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner update reference photos" on storage.objects;
create policy "owner update reference photos" on storage.objects
  for update using (
    bucket_id = 'reference-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner delete reference photos" on storage.objects;
create policy "owner delete reference photos" on storage.objects
  for delete using (
    bucket_id = 'reference-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 2. Inspirations table
-- ============================================================
create table if not exists public.inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 'photo' | 'pin' | 'board'
  kind text not null check (kind in ('photo', 'pin', 'board')),
  title text not null default '',
  note text not null default '',

  -- photo rows: path in reference-photos; optional pin URL it came from
  storage_path text,
  source_url text,

  -- pin/board rows: the URL to open in Pinterest
  url text,

  -- pin/board: public thumbnail from Pinterest oEmbed (optional)
  preview_url text,

  -- optional link to the client Styles catalog slug (e.g. 'french-crop')
  style_slug text,

  constraint inspirations_photo_has_path check (
    kind <> 'photo' or storage_path is not null
  ),
  constraint inspirations_link_has_url check (
    kind = 'photo' or url is not null
  )
);

create index if not exists inspirations_user_idx
  on public.inspirations (user_id, created_at desc);

create index if not exists inspirations_kind_idx
  on public.inspirations (user_id, kind, created_at desc);

alter table public.inspirations enable row level security;

drop policy if exists "read own inspirations" on public.inspirations;
create policy "read own inspirations" on public.inspirations
  for select using (auth.uid() = user_id);

drop policy if exists "insert own inspirations" on public.inspirations;
create policy "insert own inspirations" on public.inspirations
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own inspirations" on public.inspirations;
create policy "update own inspirations" on public.inspirations
  for update using (auth.uid() = user_id);

drop policy if exists "delete own inspirations" on public.inspirations;
create policy "delete own inspirations" on public.inspirations
  for delete using (auth.uid() = user_id);
