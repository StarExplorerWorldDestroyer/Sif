-- Sif: AI try-on — saved looks gallery.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run (idempotent).
-- Run this AFTER tryon.sql and tryon-effects.sql.
--
-- The try-on screen now shows a gallery of previously generated looks and lets
-- the owner delete ones they don't want to keep. Rows are still written only by
-- the Edge Function (service role), and reads remain owner-scoped — this adds an
-- owner DELETE policy so a user can remove their own history from the client.
-- The underlying image files live in the private `tryon-photos` bucket, whose
-- owner DELETE policy already lets the user remove their own objects.

drop policy if exists "delete own tryons" on public.hairstyle_tryons;
create policy "delete own tryons" on public.hairstyle_tryons
  for delete using (auth.uid() = user_id);
