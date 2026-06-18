-- Sif: customizable "time for a cut" reminders.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
--
-- Stores a single per-user reminder as JSON on the profile. Shape (see
-- types/index.ts → CutReminder):
--   { "rule": { "kind": "interval", "every": 2, "unit": "week", "anchor": "2026-07-01" }, "createdAt": "..." }
--   { "rule": { "kind": "nth_weekday", "ordinal": 1, "weekday": 1 }, "createdAt": "..." }
--   { "rule": { "kind": "one_off", "date": "2026-08-15" }, "createdAt": "..." }
--
-- The column is covered by the existing profiles RLS policies, so a user can
-- only read/update their own reminder.

alter table public.profiles add column if not exists cut_reminder jsonb;
