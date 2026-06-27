# App Store — App Privacy ("nutrition label") answers

Reference for filling out **App Store Connect → App Privacy**. It mirrors what
the app actually collects (see `app/privacy.tsx` for the user-facing policy).

Privacy Policy URL to enter in App Store Connect:
`https://goldensif.com/privacy`

## Summary

- **We do _not_ use data to track you** across other apps/sites. Answer **"No"**
  to "Do you or your third-party partners use data for tracking purposes?"
- All collected data is **linked to the user's identity** (it lives under their
  account).
- No third-party advertising or analytics SDKs are bundled today. If you later
  add analytics/crash reporting, revisit "Usage Data" and "Diagnostics".

## Data types to declare

For each: **Collected = Yes**, **Linked to user = Yes**, **Used for tracking = No**.

| Data type | Where it comes from | Purpose(s) |
|---|---|---|
| **Contact Info → Email Address** | Sign-up / account | App Functionality, Account Management |
| **User Content → Photos or Videos** | Haircut photos, message photos, try-on selfies/reference photos | App Functionality |
| **User Content → Other User Content** | Posts, captions, notes, comments, direct messages, reviews | App Functionality |
| **Identifiers → User ID** | Supabase auth user id | App Functionality |
| **Financial Info → Payment Info** | Booking payments/deposits (see note) | App Functionality |
| **Purchases → Purchase History** *(optional)* | Booking/payment records we store | App Functionality |

### Notes per type

- **Photos / face images (try-on):** The virtual try-on processes a photo of a
  face. We treat this as **User Content → Photos**, gated behind explicit,
  timestamped consent, processed only to produce the requested look. If a
  reviewer asks, the consent flow is in `supabase/tryon.sql`
  (`profiles.tryon_consent_at`) and the try-on UI. Consider whether your legal
  counsel wants this additionally disclosed as **Sensitive Info**.
- **Payment Info:** Card details are entered directly with **Stripe** and never
  reach our servers — we store only payment **status and amounts**. Apple lets
  you omit data collected solely by a third-party processor you don't receive,
  but because we persist payment records we disclose **Financial Info** to be
  safe. Pick "App Functionality".
- **No precise/coarse Location, Contacts, Browsing History, Search History,
  Health, or Sensitive Info** is collected.
- **No Usage Data or Diagnostics** today (no analytics/crash SDK). Leave these
  unchecked unless/until one is added.

## Third parties that receive data (for your records)

- **Supabase** — hosting, database, auth, file storage (all of the above).
- **Stripe** — payment processing (payment info; processed by Stripe directly).
- **Perfect Corp / YouCam** — receives the selected photo to generate try-on
  results.
- **Cloudflare Turnstile** — bot protection on auth forms (only if enabled).

## Related launch checklist items

- [ ] Privacy Policy URL set to `https://goldensif.com/privacy`
- [ ] Account deletion reachable in-app (Settings → Delete account) — **done**
- [ ] Enable Supabase leaked-password protection (HaveIBeenPwned) — dashboard
      toggle, see below
- [ ] App encryption: `ITSAppUsesNonExemptEncryption` already set to `false` in
      `app.json`

### Leaked-password protection (manual)

Supabase → Authentication → **Sign In / Providers** → **Password security** →
enable **"Prevent use of leaked passwords"**. Direct link:
`https://supabase.com/dashboard/project/jnbtzrkxowvqkdlgevrp/auth/providers`
