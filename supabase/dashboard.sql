-- Sif: stylist dashboard — per-appointment price for earnings tracking.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER bookings.sql.
--
-- A stylist can record what they charged for a booking; the dashboard sums
-- these across completed appointments to show earnings. The existing
-- "update own bookings" policy already lets the stylist set this.

alter table public.bookings
  add column if not exists price numeric(10, 2) not null default 0;
