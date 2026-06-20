import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';

export default function LoginScreen() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const centered = useCenteredContent(420);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.includes('@') && password.length >= 6;

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      // On success, the auth listener redirects us automatically.
    } else {
      const { error, needsConfirmation } = await signUp(email, password);
      if (error) {
        setError(error);
      } else if (needsConfirmation) {
        setMode('signin');
        setInfo('Check your email to confirm your account, then log in.');
      }
      // If confirmation isn't required, the auth listener logs us in.
    }
    setBusy(false);
  }

  async function forgotPassword() {
    if (busy) return;
    setError(null);
    setInfo(null);
    if (!email.includes('@')) {
      setError('Enter your email above first, then tap “Forgot password?”.');
      return;
    }
    setBusy(true);
    const { error } = await sendPasswordReset(email);
    setBusy(false);
    if (error) setError(error);
    else setInfo(`We sent a password reset link to ${email}.`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, centered]}>
          <View style={styles.brand}>
            <Txt variant="display" color={Palette.accent} mono glow>
              Sif
            </Txt>
            <Txt variant="label">
              {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
            </Txt>
          </View>

          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          {error ? (
            <Txt variant="label" color={Palette.accent} style={styles.error}>
              {error}
            </Txt>
          ) : null}
          {info ? (
            <Txt variant="label" color={Palette.success} style={styles.error}>
              {info}
            </Txt>
          ) : null}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={submit}
            disabled={!canSubmit || busy}>
            {busy ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="body" color={Palette.black} style={styles.buttonText}>
                {mode === 'signin' ? 'Log In' : 'Sign Up'}
              </Txt>
            )}
          </Pressable>

          {mode === 'signin' ? (
            <Pressable style={styles.forgot} onPress={forgotPassword} disabled={busy}>
              <Txt variant="label">Forgot password?</Txt>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.switch}
            onPress={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              setError(null);
              setInfo(null);
            }}>
            <Txt variant="label">
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </Txt>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  brand: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xxl },
  error: { marginBottom: Spacing.md },
  button: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    ...Glow.md,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontWeight: '600' },
  forgot: { alignItems: 'center', marginTop: Spacing.lg },
  switch: { alignItems: 'center', marginTop: Spacing.xl },
});
