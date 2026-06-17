import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ProfileLinks } from '@/components/profile/profile-links';
import { PostsGrid } from '@/components/profile/posts-grid';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { TabHeader } from '@/components/ui/tab-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchFollowCounts } from '@/lib/public';
import { useAuth } from '@/store/auth';
import { useHaircuts } from '@/store/haircuts';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useProfile } from '@/store/profile';
import { useSocial } from '@/store/social';
import type { FollowCounts } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { haircuts } = useHaircuts();
  const { connectionCount, incomingCount } = useSocial();
  const centered = useCenteredContent();
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });

  useFocusEffect(
    useCallback(() => {
      if (user) fetchFollowCounts(user.id).then(setCounts);
    }, [user]),
  );

  const name = profile?.displayName?.trim() || user?.email?.split('@')[0] || 'You';

  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://goldensif.com';

  async function shareProfile() {
    if (!profile?.username) {
      Alert.alert('Set a username first', 'Add a username in Edit Profile so people can find you.');
      return;
    }
    if (profile.privacy !== 'public') {
      Alert.alert(
        'Your profile isn’t public',
        'Set your profile to Public in Settings so anyone with the link can view it.',
      );
      return;
    }
    const url = `${origin}/u/${profile.username}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      Alert.alert('Link copied', url);
    } else {
      await Share.share({ message: url, url });
    }
  }

  return (
    <Screen padded={false}>
      <TabHeader
        title="Profile"
        actions={
          <Pressable
            style={styles.gearButton}
            hitSlop={8}
            onPress={() => router.push('/settings')}>
            <IconSymbol name="gearshape" size={24} color={Palette.text} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, centered ?? undefined]}>
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

        <ProfileLinks instagram={profile?.instagram} website={profile?.website} />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Txt variant="heading">{haircuts.length}</Txt>
            <Txt variant="caption">Cuts</Txt>
          </View>
          <View style={styles.stat}>
            <Txt variant="heading">{counts.followers}</Txt>
            <Txt variant="caption">Followers</Txt>
          </View>
          <View style={styles.stat}>
            <Txt variant="heading">{counts.following}</Txt>
            <Txt variant="caption">Following</Txt>
          </View>
          <Pressable style={styles.stat} onPress={() => router.push('/connections')}>
            <View style={styles.statCountRow}>
              <Txt variant="heading">{connectionCount}</Txt>
              {incomingCount > 0 ? <View style={styles.badge} /> : null}
            </View>
            <Txt variant="caption">Connections</Txt>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => router.push('/profile/edit')}>
            <Txt variant="label" color={Palette.text}>
              Edit Profile
            </Txt>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={shareProfile}>
            <IconSymbol name="square.and.arrow.up" size={16} color={Palette.text} />
            <Txt variant="label" color={Palette.text}>
              Share
            </Txt>
          </Pressable>
        </View>
      </View>

        <View style={styles.highlights}>
          <PostsGrid />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gearButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.lg },
  identity: { alignItems: 'center', gap: Spacing.sm },
  highlights: { marginTop: Spacing.xxl },
  avatar: { width: 96, height: 96, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bio: { textAlign: 'center', maxWidth: 280, marginTop: Spacing.xs },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  stat: { alignItems: 'center', minWidth: 56 },
  statCountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  badge: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.accent, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
});
