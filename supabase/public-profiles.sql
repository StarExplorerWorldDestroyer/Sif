-- Public profiles: make posts shareable on public profile pages.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.

-- Snapshot display fields onto the post so public pages never need to read
-- the private haircuts table (which holds price, private notes, etc).
alter table public.posts add column if not exists photo_url text not null default '';
alter table public.posts add column if not exists cut_type text not null default '';

-- Allow anyone to read posts that belong to a public profile (plus your own).
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = posts.user_id and p.profile_public = true
    )
  );
