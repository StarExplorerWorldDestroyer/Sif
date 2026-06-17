-- Sif: richer profiles — Instagram handle and a personal website/link.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
--
-- These columns are returned by the existing "read profiles" RLS policy, so
-- they're only visible on profiles the viewer is allowed to see (public, or
-- connections/private when permitted). Follower/following counts come from the
-- `follows` table, which is already publicly readable.

alter table public.profiles add column if not exists instagram text;
alter table public.profiles add column if not exists website text;
