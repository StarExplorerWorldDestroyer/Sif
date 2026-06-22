-- Sif: AI try-on — multiple effect kinds.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER tryon.sql.
--
-- Extends the try-on feature beyond hairstyles to the rest of Perfect Corp's
-- YouCam hair suite (color, bangs, length/extension, volume, wavy). Each row
-- now records which effect it was (`kind`) and the parameters used (`params`,
-- e.g. a color HEX + intensity), so history and the eventual gallery can show
-- what was applied. Rows are still written only by the Edge Function.

alter table public.hairstyle_tryons
  add column if not exists kind text not null default 'hairstyle';

alter table public.hairstyle_tryons
  add column if not exists params jsonb not null default '{}'::jsonb;
