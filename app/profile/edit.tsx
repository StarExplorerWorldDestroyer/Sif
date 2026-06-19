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
import { useFeedback } from '@/store/feedback';
import { useProfile } from '@/store/profile';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, uploadAndSetAvatar } = useProfile();
  const { toast } = useFeedback();
  const centered = useCenteredContent(640);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [instagram, setInstagram] = useState(profile?.instagram ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function changeAvatar() {
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
    const { error } = await uploadAndSetAvatar(result.assets[0].uri);
    setUploadingAvatar(false);
    if (error) toast(error, { tone: 'error' });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const { error } = await updateProfile({
      displayName: displayName.trim(),
      username: username.trim().replace(/^@/, '') || null,
      bio: bio.trim(),
      instagram: instagram.trim().replace(/^@/, ''),
      website: website.trim(),
    });
    setSaving(false);
    if (error) {
      toast(
        error.includes('duplicate') || error.includes('unique')
          ? 'That username is already taken. Try another.'
          : error,
        { tone: 'error' },
      );
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt variant="body" color={Palette.textMuted}>
            Cancel
          </Txt>
        </Pressable>
        <Txt variant="heading">Edit Profile</Txt>
        <Pressable onPress={handleSave} hitSlop={8} disabled={saving}>
          <Txt variant="body" color={saving ? Palette.textDim : Palette.accent}>
            Save
          </Txt>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, centered]} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.avatarWrap} onPress={changeAvatar}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol name="person.fill" size={40} color={Palette.textMuted} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator color={Palette.black} size="small" />
              ) : (
                <IconSymbol name="pencil" size={14} color={Palette.black} />
              )}
            </View>
          </Pressable>
          <Txt variant="caption" style={styles.avatarHint}>
            Tap to change photo
          </Txt>

          <Field
            label="Display name"
            placeholder="Your name"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Field
            label="Username"
            placeholder="username (for your share link)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Bio"
            placeholder="A little about you…"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            style={styles.bio}
          />
          <Field
            label="Instagram"
            placeholder="yourhandle"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Website"
            placeholder="yoursite.com"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  content: { padding: Spacing.lg },
  avatarWrap: { alignSelf: 'center', marginTop: Spacing.md },
  avatar: { width: 96, height: 96, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
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
  bio: { minHeight: 80, textAlignVertical: 'top' },
});
