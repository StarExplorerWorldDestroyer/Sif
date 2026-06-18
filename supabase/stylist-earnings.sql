-- Sif: stylist earnings from performed cuts.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER schema.sql and haircut-stylist.sql.
--
-- Cuts a stylist creates for clients live on the *client's* account (the
-- "own haircuts" RLS is owner-only), so a stylist can't read them directly.
-- This SECURITY DEFINER function returns just the earnings fields for every
-- cut credited to the current stylist (h.stylist_id = auth.uid()), regardless
-- of who owns it — service price, tip, date, and cut type.

create or replace function public.stylist_earnings()
returns table (
  cut_date date,
  price numeric,
  tip numeric,
  cut_type text
)
language sql
stable
security definer
set search_path = public
as $$
  select h.date as cut_date, h.price, h.tip, h.cut_type
  from public.haircuts h
  where h.stylist_id = auth.uid();
$$;

grant execute on function public.stylist_earnings() to authenticated;
