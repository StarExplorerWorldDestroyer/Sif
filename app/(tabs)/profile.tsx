import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PostsGrid } from '@/components/profile/posts-grid';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { useHaircuts } from '@/store/haircuts';
import { useProfile } from '@/store/profile';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { haircuts } = useHaircuts();

  const name = profile?.displayName?.trim() || user?.email?.split('@')[0] || 'You';

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="title">Profile</Txt>
        <Pressable hitSlop={8} onPress={() => router.push('/settings')}>
          <IconSymbol name="gearshape" size={24} color={Palette.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.identity}>
        {profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <IconSymbol name="person.fill" size={36} color={Palette.textMuted} />
          </View>
        )}
        <Txt variant="heading">{name}</Txt>
        {profile?.username ? <Txt variant="label">@{profile.username}</Txt> : null}
        {profile?.bio ? (
          <Txt variant="label" style={styles.bio}>
            {profile.bio}
          </Txt>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Txt variant="heading">{haircuts.length}</Txt>
            <Txt variant="caption">Cuts</Txt>
          </View>
        </View>

        <Pressable style={styles.editButton} onPress={() => router.push('/profile/edit')}>
          <Txt variant="label" color={Palette.text}>
            Edit Profile
          </Txt>
        </Pressable>
      </View>

        <View style={styles.highlights}>
          <PostsGrid />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  identity: { alignItems: 'center', gap: Spacing.sm },
  highlights: { marginTop: Spacing.xxl },
  avatar: { width: 96, height: 96, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bio: { textAlign: 'center', maxWidth: 280, marginTop: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.md },
  stat: { alignItems: 'center' },
  editButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
});
