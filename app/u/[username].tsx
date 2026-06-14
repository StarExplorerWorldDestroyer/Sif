import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchPostsForUser, fetchPublicProfile } from '@/lib/public';
import type { PublicPost, PublicProfile } from '@/types';

export default function PublicProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const p = await fetchPublicProfile(username);
      if (!active) return;
      setProfile(p);
      if (p) {
        const ps = await fetchPostsForUser(p.id);
        if (active) setPosts(ps);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading" color={Palette.accent}>
          Sif
        </Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <IconSymbol name="person.fill" size={40} color={Palette.textDim} />
          <Txt variant="heading" style={{ color: Palette.textMuted }}>
            Profile not found
          </Txt>
          <Txt variant="label" style={styles.muted}>
            This profile doesn&apos;t exist or isn&apos;t public.
          </Txt>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol name="person.fill" size={36} color={Palette.textMuted} />
              </View>
            )}
            <Txt variant="heading">{profile.displayName || profile.username || 'Sif user'}</Txt>
            {profile.username ? <Txt variant="label">@{profile.username}</Txt> : null}
            {profile.bio ? (
              <Txt variant="label" style={styles.bio}>
                {profile.bio}
              </Txt>
            ) : null}
            <View style={styles.statRow}>
              <Txt variant="heading">{posts.length}</Txt>
              <Txt variant="caption">{posts.length === 1 ? 'post' : 'posts'}</Txt>
            </View>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Txt variant="label" style={styles.muted}>
                No posts yet.
              </Txt>
            </View>
          ) : (
            <View style={styles.grid}>
              {posts.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.cell}
                  onPress={() => router.push(`/p/${post.id}`)}>
                  <Image source={{ uri: post.photoUrl }} style={styles.tile} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  muted: { textAlign: 'center', color: Palette.textMuted },
  identity: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  avatar: { width: 96, height: 96, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bio: { textAlign: 'center', maxWidth: 280, marginTop: Spacing.xs },
  statRow: { alignItems: 'center', marginTop: Spacing.sm },
  emptyPosts: { alignItems: 'center', paddingVertical: Spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', aspectRatio: 1, padding: 1 },
  tile: { flex: 1, backgroundColor: Palette.surfaceAlt },
});
