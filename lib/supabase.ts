import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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

export const isSupabaseConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We're not using web URL-based auth callbacks in the app.
    detectSessionInUrl: false,
  },
});
