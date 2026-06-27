// Permanently delete the calling user's account.
//
// Apple App Store Guideline 5.1.1(v) requires apps that support account
// creation to also let users delete their account from within the app — not
// just their data. Deleting the auth user needs the service role, so it lives
// here rather than client-side.
//
// What gets removed:
//   1. Every storage object the user owns. All our buckets path objects as
//      `{uid}/...`, so we purge that prefix from each bucket.
//   2. The auth user itself. Almost every table references auth.users(id) with
//      ON DELETE CASCADE (profiles, haircuts, posts, messages, bookings,
//      payments, try-ons, …), so deleting the user cascades the rest. The few
//      ON DELETE SET NULL references (e.g. a stylist tagged on someone else's
//      haircut) are intentionally nulled, not removed.
//
// Note: a stylist's Stripe Connect account is left in place on Stripe — only
// our local mapping row is removed via cascade. Orphaned Connect accounts are
// harmless and can be cleaned up out of band.

import { getAdmin, getUserId, json, withCors } from '../_shared/util.ts';

// Buckets that store user-owned objects under a `{uid}/` prefix.
const BUCKETS = ['avatars', 'haircut-photos', 'message-photos', 'tryon-photos'];

// deno-lint-ignore no-explicit-any
async function purgeBucket(admin: any, bucket: string, prefix: string): Promise<void> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return;
  const files: string[] = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Folders come back with a null id; recurse into them.
    if (entry.id === null) {
      await purgeBucket(admin, bucket, path);
    } else {
      files.push(path);
    }
  }
  if (files.length) {
    const { error: rmErr } = await admin.storage.from(bucket).remove(files);
    if (rmErr) console.error(`delete-account: remove failed in ${bucket}:`, rmErr);
  }
}

Deno.serve((req) =>
  withCors(req, async () => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    const admin = getAdmin();
    const uid = await getUserId(req, admin);
    if (!uid) return json({ error: 'Not authenticated.' }, 401);

    // 1) Best-effort purge of owned storage objects. Failures here shouldn't
    //    block account deletion — orphaned files are far less sensitive than a
    //    lingering account, and they're owner-scoped regardless.
    for (const bucket of BUCKETS) {
      try {
        await purgeBucket(admin, bucket, uid);
      } catch (e) {
        console.error(`delete-account: purge error in ${bucket}:`, e);
      }
    }

    // 2) Delete the auth user. Cascades remove the rest of their rows.
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) {
      console.error('delete-account: deleteUser failed:', error);
      return json({ error: 'Could not delete your account. Please try again.' }, 500);
    }

    return json({ ok: true });
  }),
);
