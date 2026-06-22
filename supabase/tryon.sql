-- Sif: AI hairstyle try-on (Spike 1).
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
--
-- This backs the "Try a look" feature: a user uploads a selfie and sees a
-- chosen hairstyle rendered on them. The actual generation happens in the
-- `hairstyle-tryon` Edge Function, which proxies Perfect Corp's YouCam API so
-- the API key never touches the client.
--
-- What this migration creates:
--   1. profiles.tryon_consent_at  — explicit, timestamped consent to process a
--      photo of the user's face (biometric data). No try-on runs without it.
--   2. A PRIVATE `tryon-photos` storage bucket for selfies, reference photos,
--      and results, scoped to the owner via signed URLs (like message-photos).
--   3. A `hairstyle_tryons` job table. Rows are written only by the Edge
--      Function (service role); users can read their own history.

-- ============================================================
-- 1. Consent (face/biometric data is sensitive — opt-in, logged)
-- ============================================================
alter table public.profiles add column if not exists tryon_consent_at timestamptz;

-- ============================================================
-- 2. Private storage bucket for try-on images
--    Object paths are `{uid}/{tryonId}/{file}` so the owner check is the
--    first path segment, exactly like the message-photos bucket.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tryon-photos', 'tryon-photos', false)
on conflict (id) do nothing;

drop policy if exists "owner read tryon photos" on storage.objects;
create policy "owner read tryon photos" on storage.objects
  for select using (
    bucket_id = 'tryon-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner upload tryon photos" on storage.objects;
create policy "owner upload tryon photos" on storage.objects
  for insert with check (
    bucket_id = 'tryon-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner update tryon photos" on storage.objects;
create policy "owner update tryon photos" on storage.objects
  for update using (
    bucket_id = 'tryon-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner delete tryon photos" on storage.objects;
create policy "owner delete tryon photos" on storage.objects
  for delete using (
    bucket_id = 'tryon-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 3. Try-on job table
-- ============================================================
create table if not exists public.hairstyle_tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 'pending' | 'processing' | 'succeeded' | 'failed'
  status text not null default 'pending',
  -- 'template' (built-in library) | 'reference' (user/stylist photo)
  source text not null,
  style_label text not null default '',
  template_id text,

  selfie_path text not null,    -- storage path in tryon-photos
  ref_path text,                -- storage path of a reference style photo
  result_path text,             -- storage path of the generated result
  provider text not null default 'perfectcorp',
  provider_task_id text,
  error text
);

create index if not exists hairstyle_tryons_user_idx
  on public.hairstyle_tryons (user_id, created_at desc);

alter table public.hairstyle_tryons enable row level security;

-- Users can read their own try-on history. Inserts/updates are performed by
-- the Edge Function with the service role (which bypasses RLS), so there are
-- deliberately no client INSERT/UPDATE policies.
drop policy if exists "read own tryons" on public.hairstyle_tryons;
create policy "read own tryons" on public.hairstyle_tryons
  for select using (auth.uid() = user_id);
