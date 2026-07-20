import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Safe, non-technical copy shown in toasts. Details go to `client_error_logs`. */
export const UserError = {
  generic: 'Something went wrong. Please try again.',
  saveHaircut: 'Something went wrong saving your haircut. Please try again.',
  saveHaircutPhotos:
    'Your cut and notes were saved, but photos didn’t upload. You can retry photos from Edit.',
  tryonGenerate: 'Could not generate this look. Please try again.',
  tryonStyles: 'Could not load styles. Please try again.',
  tryonSave: 'Could not save that look. Please try again.',
  tryonPhoto: 'Could not use that photo. Please try another.',
  tryonAddStep: 'Could not add that to your look. Please try again.',
} as const;

/** Pull a string message out of unknown thrown / API errors (for logging only). */
export function errorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (!error) return fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object') {
    const obj = error as { message?: unknown; error?: unknown; code?: unknown };
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
    if (typeof obj.code === 'string' && obj.code.trim()) return obj.code;
    try {
      return JSON.stringify(error);
    } catch {
      // ignore
    }
  }
  return fallback;
}

/**
 * A few server messages are already written for humans (rate limits, consent).
 * Everything else becomes a generic toast — the raw text is only logged.
 */
export function userFacingMessage(detailed: string | null | undefined, fallback: string): string {
  if (!detailed) return fallback;
  if (/try-on limit/i.test(detailed) || /last hour/i.test(detailed)) return detailed;
  if (/consent is required/i.test(detailed)) {
    return 'Please agree to continue using try-on.';
  }
  return fallback;
}

type ReportArgs = {
  /** Short dotted scope, e.g. `haircut.save`, `tryon.create`. */
  scope: string;
  /** Human-readable detail for the log (never shown in the UI). */
  message: string;
  /** Optional structured context (ids, kinds, statuses — avoid notes/PII). */
  detail?: Record<string, unknown>;
};

/**
 * Fire-and-forget write to `client_error_logs`. Failures are swallowed so
 * logging never breaks the user flow. Also mirrors to the console in dev.
 */
export function reportClientError({ scope, message, detail }: ReportArgs): void {
  if (__DEV__) {
    console.error(`[${scope}]`, message, detail ?? '');
  }
  void (async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const appVersion =
        Constants.expoConfig?.version ??
        Constants.nativeAppVersion ??
        null;
      await supabase.from('client_error_logs').insert({
        user_id: userId,
        scope,
        message: message.slice(0, 2000),
        detail: detail ?? null,
        platform: Platform.OS,
        app_version: appVersion,
      });
    } catch {
      // never surface logging failures
    }
  })();
}
