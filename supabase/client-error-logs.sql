-- Client-side error log for diagnosing TestFlight / prod issues.
-- Users can INSERT their own rows; nobody (including the reporter) can SELECT
-- via the anon/authenticated roles — read these in the Supabase SQL editor:
--
--   select created_at, scope, message, detail, platform, app_version, user_id
--   from client_error_logs
--   order by created_at desc
--   limit 50;

create table if not exists public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  scope text not null,
  message text not null,
  detail jsonb,
  platform text,
  app_version text,
  created_at timestamptz not null default now()
);

create index if not exists client_error_logs_created_at_idx
  on public.client_error_logs (created_at desc);

create index if not exists client_error_logs_scope_idx
  on public.client_error_logs (scope, created_at desc);

alter table public.client_error_logs enable row level security;

drop policy if exists "Users insert own client errors" on public.client_error_logs;
create policy "Users insert own client errors"
  on public.client_error_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- No SELECT / UPDATE / DELETE policies for authenticated or anon.
-- Service role (dashboard / SQL editor) bypasses RLS for inspection.
