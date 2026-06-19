// Sif: web push sender.
//
// Invoked by the `notify_push` trigger (see supabase/push.sql) over pg_net for
// every (re)surfaced row in public.notifications. Resolves the recipient's
// browser push subscriptions and delivers a web push using VAPID.
//
// Deploy:   supabase functions deploy push --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//                                PUSH_SECRET=... VAPID_SUBJECT=mailto:you@example.com
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
const pushSecret = Deno.env.get('PUSH_SECRET')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@sif.app';

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

const admin = createClient(supabaseUrl, serviceKey);

type NotificationRow = {
  user_id: string;
  actor_id: string | null;
  type: string;
  entity_id: string | null;
  read: boolean;
};

async function actorName(actorId: string | null): Promise<string> {
  if (!actorId) return 'Someone';
  const { data } = await admin
    .from('profiles')
    .select('display_name, username')
    .eq('id', actorId)
    .maybeSingle();
  return data?.display_name || (data?.username ? `@${data.username}` : 'Someone');
}

function copyFor(type: string, name: string): { title: string; body: string } {
  switch (type) {
    case 'connection_request':
      return { title: 'New connection request', body: `${name} wants to connect` };
    case 'connection_accepted':
      return { title: 'Connection accepted', body: `${name} accepted your request` };
    case 'follow':
      return { title: 'New follower', body: `${name} started following you` };
    case 'pending_cut':
      return { title: 'New cut to review', body: `${name} sent you a cut` };
    case 'post_tag':
      return { title: 'Tagged in a post', body: `${name} tagged you` };
    case 'post_like':
      return { title: 'New like', body: `${name} liked your post` };
    case 'post_comment':
      return { title: 'New comment', body: `${name} commented on your post` };
    case 'comment_reply':
      return { title: 'New reply', body: `${name} replied to your comment` };
    case 'booking_requested':
      return { title: 'Booking request', body: `${name} requested a booking` };
    case 'booking_confirmed':
      return { title: 'Booking confirmed', body: `${name} confirmed your booking` };
    case 'booking_declined':
      return { title: 'Booking declined', body: `${name} declined your booking` };
    case 'booking_cancelled':
      return { title: 'Booking cancelled', body: `${name} cancelled a booking` };
    case 'booking_reminder':
      return { title: 'Upcoming appointment', body: `Appointment with ${name}` };
    case 'booking_rescheduled':
      return { title: 'Booking rescheduled', body: `${name} rescheduled a booking` };
    case 'review_received':
      return { title: 'New review', body: `${name} left you a review` };
    case 'review_reply':
      return { title: 'Review reply', body: `${name} replied to your review` };
    case 'message':
      return { title: 'New message', body: `${name} sent you a message` };
    default:
      return { title: 'Sif', body: name };
  }
}

function urlFor(type: string, entityId: string | null, actorId: string | null): string {
  switch (type) {
    case 'connection_request':
      return '/connections';
    case 'pending_cut':
      return '/pending';
    case 'post_tag':
    case 'post_like':
    case 'post_comment':
    case 'comment_reply':
      return entityId ? `/p/${entityId}` : '/';
    case 'booking_requested':
    case 'booking_confirmed':
    case 'booking_declined':
    case 'booking_cancelled':
    case 'booking_reminder':
    case 'booking_rescheduled':
    case 'review_received':
      return '/bookings';
    case 'message':
      return entityId ? `/messages/${entityId}` : '/messages';
    case 'connection_accepted':
    case 'follow':
    case 'review_reply':
    default:
      return '/notifications';
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== pushSecret) {
    return new Response('forbidden', { status: 403 });
  }

  let record: NotificationRow | null = null;
  try {
    const payload = await req.json();
    record = payload.record ?? null;
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!record || record.read) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', record.user_id);

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = await actorName(record.actor_id);
  const { title, body } = copyFor(record.type, name);
  const url = urlFor(record.type, record.entity_id, record.actor_id);
  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(s.endpoint);
      }
    }),
  );

  if (stale.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
