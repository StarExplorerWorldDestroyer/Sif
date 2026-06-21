import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter for the auth session.
 *
 * - Native (iOS/Android): expo-secure-store, so the access/refresh tokens live
 *   in the iOS Keychain / Android Keystore rather than plaintext AsyncStorage.
 *   (Note: Android SecureStore values are capped ~2KB; revisit with a chunked/
 *   encrypted adapter when Android ships.)
 * - Web: localStorage, but guarded so it doesn't crash during the static
 *   web build (which runs in Node, where `window` doesn't exist).
 */
const webStorage = {
  getItem: (key: string) =>
    Promise.resolve(typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const authStorage = Platform.OS === 'web' ? webStorage : secureStorage;

/**
 * Supabase connection details.
 *
 * These are SAFE to commit — the anon key is a public client key, and access is
 * controlled by Row-Level Security policies in the database (see supabase/schema.sql).
 *
 * Find these in your Supabase project: Settings → API → "Project URL" and
 * "Project API keys → anon public".
 */
const SUPABASE_URL = 'https://jnbtzrkxowvqkdlgevrp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuYnR6cmt4b3d2cWtkbGdldnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NTAzODcsImV4cCI6MjA5NzAyNjM4N30._qjzWqqH1VnrtQWIZkfvH8pLnpQu_ihpPLApKUbhb38';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, parse auth tokens from the URL (email confirmation + password
    // reset links redirect back here with tokens in the URL hash).
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/**
 * Where Supabase auth emails (confirmation, password reset) should redirect.
 * On web this is the current site origin; on native it's the app's deep-link
 * scheme. Configure these as allowed Redirect URLs in the Supabase dashboard.
 */
export function authRedirectTo(path = ''): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `sif://${path.replace(/^\//, '')}`;
}
