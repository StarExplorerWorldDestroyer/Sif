import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authRedirectTo, supabase } from '@/lib/supabase';

/** Parse auth params from either the query string or the URL fragment (#...). */
function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (s: string) => {
    for (const part of s.split('&')) {
      if (!part) continue;
      const [k, v] = part.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    }
  };
  const hashIdx = url.indexOf('#');
  const qIdx = url.indexOf('?');
  if (qIdx >= 0) grab(url.slice(qIdx + 1, hashIdx >= 0 ? hashIdx : undefined));
  if (hashIdx >= 0) grab(url.slice(hashIdx + 1));
  return out;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True while the user is in a password-recovery flow (clicked a reset link). */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Returns needsConfirmation=true when a confirmation email was sent. */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Native deep links (e.g. the password-reset email opens `sif://reset#...`).
  // Web handles this via detectSessionInUrl; on native we parse the tokens and
  // establish the session ourselves, flagging recovery so the app routes to the
  // reset screen. Guarded to native so it never affects the web flow.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const p = parseAuthParams(url);
      try {
        if (p.access_token && p.refresh_token) {
          await supabase.auth.setSession({
            access_token: p.access_token,
            refresh_token: p.refresh_token,
          });
          if (p.type === 'recovery' || url.includes('reset')) setRecovering(true);
        } else if (p.code) {
          await supabase.auth.exchangeCodeForSession(p.code);
          if (p.type === 'recovery' || url.includes('reset')) setRecovering(true);
        }
      } catch {
        // Ignore malformed/expired links; the user can request a new one.
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: authRedirectTo('/') },
    });
    // When email confirmation is required, no session is returned yet.
    const needsConfirmation = !error && !data.session;
    return { error: error?.message ?? null, needsConfirmation };
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectTo('/reset'),
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return { error: error?.message ?? null };
  }

  async function signOut() {
    setRecovering(false);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        recovering,
        signIn,
        signUp,
        sendPasswordReset,
        updatePassword,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
