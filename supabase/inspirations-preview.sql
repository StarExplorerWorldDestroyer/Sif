-- Add oEmbed preview thumbnail URL for pin/board inspiration rows.
-- Safe to re-run.

alter table public.inspirations
  add column if not exists preview_url text;
