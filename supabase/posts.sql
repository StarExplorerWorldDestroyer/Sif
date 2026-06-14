-- Posts: publish a saved haircut to your profile (Instagram-style post).
-- Each post references a single haircut and has an optional caption.

-- If you ran the earlier "highlights" experiment, clean it up.
drop table if exists public.highlights;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  haircut_id uuid not null references public.haircuts (id) on delete cascade,
  caption text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists posts_user_id_idx on public.posts (user_id);

alter table public.posts enable row level security;

drop policy if exists "own posts" on public.posts;
create policy "own posts" on public.posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
