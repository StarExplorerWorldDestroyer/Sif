import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = password.length >= 6 && password === confirm && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Txt variant="title">Set a new password</Txt>
            <Txt variant="label">Enter a new password for your account.</Txt>
          </View>

          <Field
            label="New password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            required
          />
          <Field
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            required
          />

          {confirm.length > 0 && password !== confirm ? (
            <Txt variant="label" color={Palette.accent} style={styles.error}>
              Passwords don&apos;t match.
            </Txt>
          ) : null}
          {error ? (
            <Txt variant="label" color={Palette.accent} style={styles.error}>
              {error}
            </Txt>
          ) : null}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={submit}
            disabled={!canSubmit}>
            {busy ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="body" color={Palette.black} style={styles.buttonText}>
                Update password
              </Txt>
            )}
          </Pressable>

          <Pressable style={styles.switch} onPress={signOut}>
            <Txt variant="label">Cancel</Txt>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
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
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontWeight: '600' },
  switch: { alignItems: 'center', marginTop: Spacing.xl },
});
