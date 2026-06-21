import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// VAPID public key (safe to expose). The matching private key lives only in the
// `push` Edge Function's secrets — never in the client or repo.
const VAPID_PUBLIC_KEY =
  'BMew3z0gH_-FwSeYle5QS8OCtZBJ8nO2xWaZ6o2FgTyF74WIOfuDxAOQhIE45AaVZUdT3-y7yafs6mDMinNUdWk';

/** True when this runtime can do browser web push. */
export function isWebPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

/** True if this browser already has an active push subscription. */
export async function isWebPushEnabled(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return false;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return false;
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { endpoint: json.endpoint, user_id: uid, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' },
    );
  return !error;
}

type EnableResult = 'enabled' | 'denied' | 'unsupported' | 'error';

/**
 * Register the service worker, request permission, subscribe, and persist the
 * subscription. Must be called from a user gesture so the permission prompt
 * is allowed.
 */
export async function enableWebPush(): Promise<EnableResult> {
  if (!isWebPushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await getRegistration();
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    const saved = await saveSubscription(sub);
    return saved ? 'enabled' : 'error';
  } catch {
    return 'error';
  }
}

/** Unsubscribe this browser and remove the stored subscription. */
export async function disableWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
    return true;
  } catch {
    return false;
  }
}
