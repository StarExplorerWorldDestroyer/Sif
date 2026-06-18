import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileLinks } from '@/components/profile/profile-links';
import { RelationshipButtons } from '@/components/social/relationship-buttons';
import { StylistHours } from '@/components/social/stylist-hours';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchFollowCounts, fetchPostsForUser, fetchProfileView } from '@/lib/public';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useProfile } from '@/store/profile';
import { useSocial } from '@/store/social';
import type { FollowCounts, PublicPost, PublicProfile, UserSearchResult } from '@/types';

export default function PublicProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const centered = useCenteredContent(680);
  const { profile } = useProfile();
  const { connectionStatus } = useSocial();

  const [card, setCard] = useState<UserSearchResult | null>(null);
  const [full, setFull] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const view = await fetchProfileView(username);
      if (!active) return;
      setCard(view.card);
      setFull(view.full);
      if (view.card) {
        const c = await fetchFollowCounts(view.card.id);
        if (active) setCounts(c);
      }
      if (view.full) {
        const ps = await fetchPostsForUser(view.full.id);
        if (active) setPosts(ps);
      } else {
        setPosts([]);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username]);

  const name = full?.displayName || card?.displayName || card?.username || 'Sif user';
  const avatarUrl = full?.avatarUrl || card?.avatarUrl || '';

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
      ) : !card ? (
        <View style={styles.center}>
          <IconSymbol name="person.fill" size={40} color={Palette.textDim} />
          <Txt variant="heading" style={{ color: Palette.textMuted }}>
            Profile not found
          </Txt>
          <Txt variant="label" style={styles.muted}>
            This profile doesn&apos;t exist.
          </Txt>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={centered ?? undefined}>
          <View style={styles.identity}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol name="person.fill" size={36} color={Palette.textMuted} />
              </View>
            )}
            <View style={styles.nameRow}>
              <Txt variant="heading">{name}</Txt>
              {card.isStylist ? (
                <View style={styles.stylistBadge}>
                  <Txt variant="caption" color={Palette.black}>
                    Stylist
                  </Txt>
                </View>
              ) : null}
            </View>
            {card.username ? <Txt variant="label">@{card.username}</Txt> : null}

            <View style={styles.statsRow}>
              {full ? (
                <View style={styles.stat}>
                  <Txt variant="heading">{posts.length}</Txt>
                  <Txt variant="caption">Posts</Txt>
                </View>
              ) : null}
              <View style={styles.stat}>
                <Txt variant="heading">{counts.followers}</Txt>
                <Txt variant="caption">Followers</Txt>
              </View>
              <View style={styles.stat}>
                <Txt variant="heading">{counts.following}</Txt>
                <Txt variant="caption">Following</Txt>
              </View>
            </View>

            {full?.bio ? (
              <Txt variant="label" style={styles.bio}>
                {full.bio}
              </Txt>
            ) : null}

            <ProfileLinks instagram={full?.instagram} website={full?.website} />

            <View style={styles.buttons}>
              <RelationshipButtons userId={card.id} />
            </View>

            {card.isStylist && profile?.id !== card.id ? (
              <Pressable style={styles.bookButton} onPress={() => router.push(`/book/${card.id}`)}>
                <IconSymbol name="calendar" size={16} color={Palette.black} />
                <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                  Book an appointment
                </Txt>
              </Pressable>
            ) : null}

            {card.isStylist ? <StylistHours stylistId={card.id} /> : null}

            {profile?.isStylist && connectionStatus(card.id) === 'connected' ? (
              <Pressable
                style={styles.stylistAction}
                onPress={() =>
                  router.push(`/add?clientId=${card.id}&clientName=${card.username ?? ''}`)
                }>
                <IconSymbol name="scissors" size={16} color={Palette.black} />
                <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                  Create a cut for them
                </Txt>
              </Pressable>
            ) : null}
          </View>

          {full ? (
            posts.length === 0 ? (
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
                    {post.likeCount > 0 || post.commentCount > 0 ? (
                      <View style={styles.tileStats}>
                        {post.likeCount > 0 ? (
                          <View style={styles.tileStat}>
                            <IconSymbol name="heart.fill" size={12} color={Palette.text} />
                            <Txt variant="caption" color={Palette.text}>
                              {post.likeCount}
                            </Txt>
                          </View>
                        ) : null}
                        {post.commentCount > 0 ? (
                          <View style={styles.tileStat}>
                            <IconSymbol name="bubble.right" size={12} color={Palette.text} />
                            <Txt variant="caption" color={Palette.text}>
                              {post.commentCount}
                            </Txt>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <View style={styles.privateBox}>
              <IconSymbol name="lock.fill" size={28} color={Palette.textMuted} />
              <Txt variant="heading" style={{ color: Palette.textMuted }}>
                This account is {card.privacy === 'connections' ? 'connections-only' : 'private'}
              </Txt>
              <Txt variant="label" style={styles.muted}>
                {card.privacy === 'connections'
                  ? 'Connect to see their posts.'
                  : 'Only the owner can view this profile.'}
              </Txt>
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stylistBadge: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.md },
  stat: { alignItems: 'center', minWidth: 64 },
  bio: { textAlign: 'center', maxWidth: 280, marginTop: Spacing.md },
  buttons: { marginTop: Spacing.md },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: Palette.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  stylistAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: Palette.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  emptyPosts: { alignItems: 'center', paddingVertical: Spacing.xxl },
  privateBox: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', aspectRatio: 1, padding: 1 },
  tile: { flex: 1, backgroundColor: Palette.surfaceAlt },
  tileStats: {
    position: 'absolute',
    bottom: Spacing.xs + 1,
    left: Spacing.xs + 1,
    right: Spacing.xs + 1,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  tileStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
