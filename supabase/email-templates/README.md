# Sif email templates

Branded HTML for Supabase Auth emails (dark theme, orange `#FF5733` accent,
links back to `goldensif.com`). These are applied in the **Supabase dashboard**,
not by the app — they live here so changes are tracked in version control.

## How to apply

Supabase dashboard → **Authentication → Emails → Templates**. For each template
below, set the **Subject**, then paste the matching file's HTML into the
**message body**, and **Save**.

| Template (in Supabase)   | File                   | Subject                        |
| ------------------------ | ---------------------- | ------------------------------ |
| Confirm signup           | `confirm-signup.html`  | Confirm your Sif account       |
| Reset password           | `reset-password.html`  | Reset your Sif password        |
| Magic Link               | `magic-link.html`      | Your Sif sign-in link          |
| Change Email Address     | `change-email.html`    | Confirm your new Sif email     |
| Invite user              | `invite.html`          | You're invited to Sif          |
| Reauthentication         | `reauthentication.html`| Your Sif verification code     |

## Template variables

Supabase fills these in with Go templating:

- `{{ .ConfirmationURL }}` — action link (used by all but Reauthentication).
- `{{ .Token }}` — one-time numeric code (Reauthentication).
- `{{ .Email }}` / `{{ .NewEmail }}` — old/new address (Change Email).

## Notes

- Built with email-safe HTML (tables + inline styles). Rounded corners on the
  button may render square in older Outlook — harmless.
- If you edit colors, the source of truth for the app palette is
  `constants/theme.ts` (`accent` = `#FF5733`).
