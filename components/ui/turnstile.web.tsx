// Cloudflare Turnstile CAPTCHA for the web auth form. Dormant until a site key
// is provided via EXPO_PUBLIC_TURNSTILE_SITE_KEY: with no key it renders nothing
// and `turnstileConfigured` is false, so the login screen never blocks on it.
//
// To enable:
//   1. Create a Turnstile site at https://dash.cloudflare.com (free).
//   2. Set EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key> in the web env.
//   3. In Supabase → Auth → Attack Protection, turn on CAPTCHA (Turnstile) and
//      paste the matching SECRET key.

import { useCallback, useEffect, useRef } from 'react';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/** True when a Turnstile site key is configured for this build. */
export const turnstileConfigured = SITE_KEY.length > 0;

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};

declare global {
  var turnstile: TurnstileApi | undefined;
}

let scriptPromise: Promise<void> | null = null;
function ensureScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (globalThis.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile_load_failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const cb = useCallback(onToken, [onToken]);

  useEffect(() => {
    if (!turnstileConfigured) return;
    let cancelled = false;
    ensureScript()
      .then(() => {
        if (cancelled || !containerRef.current || !globalThis.turnstile) return;
        widgetIdRef.current = globalThis.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          callback: (token: string) => cb(token),
          'expired-callback': () => cb(null),
          'error-callback': () => cb(null),
        });
      })
      .catch(() => cb(null));
    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      if (id && globalThis.turnstile) {
        try {
          globalThis.turnstile.remove(id);
        } catch {
          /* widget already gone */
        }
      }
      widgetIdRef.current = null;
    };
  }, [cb]);

  if (!turnstileConfigured) return null;
  return <div ref={containerRef} style={{ marginBottom: 12 }} />;
}
