-- Sif: link a real stylist account to a haircut (in addition to the free-text
-- stylist name). Lets the "Stylist" field on a cut tag an actual Sif user.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).

alter table public.haircuts
  add column if not exists stylist_id uuid references auth.users (id) on delete set null;
