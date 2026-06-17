import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, updateProfile, uploadAndSetAvatar } = useProfile();
  const centered = useCenteredContent(460);

  const emailPrefix = user?.email?.split('@')[0] ?? '';
  const [displayName, setDisplayName] = useState(profile?.displayName || emailPrefix);
  const [username, setUsername] = useState(normalizeUsername(profile?.username || emailPrefix));
  const [isStylist, setIsStylist] = useState(profile?.isStylist ?? false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = displayName.trim().length > 0;
  const usernameOk = USERNAME_RE.test(username);
  const canSubmit = nameOk && usernameOk && !saving && !uploadingAvatar;

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    const { error: upErr } = await uploadAndSetAvatar(result.assets[0].uri);
    setUploadingAvatar(false);
    if (upErr) Alert.alert('Could not upload', upErr);
  }

  async function finish() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const { error: saveErr } = await updateProfile({
      displayName: displayName.trim(),
      username,
      isStylist,
    });
    setSaving(false);
    if (saveErr) {
      setError(
        saveErr.includes('duplicate') || saveErr.includes('unique')
          ? 'That username is already taken. Try another.'
          : saveErr,
      );
      return;
    }
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Txt variant="display" color={Palette.accent}>
              Sif
            </Txt>
            <Txt variant="heading" style={styles.welcome}>
              Set up your profile
            </Txt>
            <Txt variant="label" style={styles.sub}>
              Pick a name and a username so friends and stylists can find you.
            </Txt>
          </View>

          <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol name="camera.fill" size={28} color={Palette.textMuted} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator color={Palette.black} size="small" />
              ) : (
                <IconSymbol name="plus" size={14} color={Palette.black} />
              )}
            </View>
          </Pressable>
          <Txt variant="caption" style={styles.avatarHint}>
            Add a photo (optional)
          </Txt>

          <Field
            label="Display name"
            required
            placeholder="Your name"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Field
            label="Username"
            required
            placeholder="username"
            value={username}
            onChangeText={(t) => setUsername(normalizeUsername(t))}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Txt variant="caption" style={styles.hint}>
            {username
              ? `goldensif.com/u/${username}`
              : '3–20 characters: letters, numbers, underscores.'}
          </Txt>

          <Pressable style={styles.toggleRow} onPress={() => setIsStylist((s) => !s)}>
            <View style={styles.toggleText}>
              <Txt variant="body">I'm a stylist</Txt>
              <Txt variant="caption" color={Palette.textMuted}>
                Get tagged in clients' cuts and submit cuts to their account.
              </Txt>
            </View>
            <View style={[styles.checkbox, isStylist && styles.checkboxOn]}>
              {isStylist ? <IconSymbol name="checkmark" size={16} color={Palette.black} /> : null}
            </View>
          </Pressable>

          {error ? (
            <Txt variant="label" color={Palette.accent} style={styles.error}>
              {error}
            </Txt>
          ) : null}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={finish}
            disabled={!canSubmit}>
            {saving ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="body" color={Palette.black} style={styles.buttonText}>
                Get started
              </Txt>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  brand: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  welcome: { marginTop: Spacing.sm },
  sub: { textAlign: 'center', maxWidth: 320, color: Palette.textMuted },
  avatarWrap: { alignSelf: 'center' },
  avatar: { width: 88, height: 88, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Palette.black,
  },
  avatarHint: { textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl },
  hint: { marginTop: -Spacing.md, marginBottom: Spacing.lg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  toggleText: { flex: 1, gap: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Palette.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  error: { marginTop: Spacing.lg, textAlign: 'center' },
  button: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontWeight: '600' },
});
