// Cloudflare Turnstile is a browser widget, so there is nothing to render on
// native — this is a no-op. The web build uses turnstile.web.tsx instead.
// `turnstileConfigured` is false here so native auth never expects a token.

export const turnstileConfigured = false;

export function Turnstile(_props: { onToken: (token: string | null) => void }) {
  return null;
}
