import { AppImage as Image } from '@/components/ui/app-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { TabHeader } from '@/components/ui/tab-header';
import { Txt } from '@/components/ui/text';
import { UserResultRow } from '@/components/ui/user-result-row';
import { UserSearchBox } from '@/components/ui/user-search-box';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { setPostLike } from '@/lib/engagement';
import { fetchPublicFeed } from '@/lib/public';
import { useCenteredContent, useIsDesktop } from '@/hooks/use-responsive';
import { useUserSearch } from '@/hooks/use-user-search';
import type { PublicPost } from '@/types';

export default function ExploreScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const centered = useCenteredContent();
  const [feed, setFeed] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { query, setQuery, results, searching, active: searchActive, clear } = useUserSearch();

  const load = useCallback(async () => {
    const posts = await fetchPublicFeed();
    setFeed(posts);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleLike = useCallback((post: PublicPost) => {
    const like = !post.likedByMe;
    setFeed((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: like, likeCount: Math.max(0, p.likeCount + (like ? 1 : -1)) }
          : p,
      ),
    );
    setPostLike(post.id, like).catch(() => load());
  }, [load]);

  return (
    <Screen padded={false}>
      <TabHeader title="Explore" />

      <View style={[styles.searchWrap, centered]}>
        <UserSearchBox value={query} onChangeText={setQuery} onClear={clear} shape="pill" />
      </View>

      {searchActive ? (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {searching ? (
            <View style={styles.center}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : results.length === 0 ? (
            <Txt variant="label" style={styles.emptyText}>
              No people found for “{query.trim()}”.
            </Txt>
          ) : (
            results.map((u) => (
              <UserRowLink key={u.id} username={u.username}>
                <UserResultRow
                  user={u}
                  trailing={<IconSymbol name="chevron.right" size={16} color={Palette.textDim} />}
                />
              </UserRowLink>
            ))
          )}
        </ScrollView>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.content, centered]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={Palette.accent}
          />
        }>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Palette.accent} />
          </View>
        ) : feed.length === 0 ? (
          <EmptyState
            icon="safari"
            title="Nothing here yet"
            subtitle="Public posts from the community show up here. Make your profile public and share a cut to be the first."
            primaryLabel="Share a cut"
            onPrimary={() => router.push('/add')}
          />
        ) : (
          <View style={styles.grid}>
            {feed.map((post) => (
              <View
                key={post.id}
                style={[styles.cell, { width: isDesktop ? '33.333%' : '100%' }]}>
                <View style={styles.card}>
                  <Pressable onPress={() => router.push(`/p/${post.id}`)}>
                    <View style={styles.cardHeader}>
                      {post.author.avatarUrl ? (
                        <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <IconSymbol name="person.fill" size={14} color={Palette.textMuted} />
                        </View>
                      )}
                      <Txt variant="label" color={Palette.text}>
                        {post.author.username || post.author.displayName || 'Sif user'}
                      </Txt>
                    </View>
                    <Image source={{ uri: post.photoUrl }} style={styles.photo} contentFit="cover" />
                    {post.caption ? (
                      <Txt variant="label" numberOfLines={2} style={styles.caption}>
                        {post.caption}
                      </Txt>
                    ) : null}
                    {post.stylist ? (
                      <View style={styles.stylistCredit}>
                        <IconSymbol name="scissors" size={12} color={Palette.textMuted} />
                        <Txt variant="caption" color={Palette.textMuted} numberOfLines={1}>
                          {post.stylist.displayName || `@${post.stylist.username}`}
                        </Txt>
                      </View>
                    ) : null}
                  </Pressable>
                  <View style={styles.engageRow}>
                    <Pressable
                      style={styles.engageBtn}
                      onPress={() => toggleLike(post)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'}>
                      <IconSymbol
                        name={post.likedByMe ? 'heart.fill' : 'heart'}
                        size={18}
                        color={post.likedByMe ? Palette.accent : Palette.textMuted}
                      />
                      {post.likeCount > 0 ? (
                        <Txt variant="caption" color={post.likedByMe ? Palette.accent : Palette.textMuted}>
                          {post.likeCount}
                        </Txt>
                      ) : null}
                    </Pressable>
                    <Pressable
                      style={styles.engageBtn}
                      onPress={() => router.push(`/p/${post.id}`)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="View comments">
                      <IconSymbol name="bubble.right" size={18} color={Palette.textMuted} />
                      {post.commentCount > 0 ? (
                        <Txt variant="caption" color={Palette.textMuted}>
                          {post.commentCount}
                        </Txt>
                      ) : null}
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      )}
    </Screen>
  );
}

/**
 * A search-result row that links to a user's public profile. Uses Expo
 * Router's Link (a real anchor on web) so taps register reliably on mobile
 * browsers.
 */
function UserRowLink({ username, children }: { username: string | null; children: ReactNode }) {
  if (!username) return <View>{children}</View>;
  return (
    <Link href={`/u/${username}`} asChild>
      <Pressable>{children}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl * 2 },
  emptyText: { textAlign: 'center', maxWidth: 280, color: Palette.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { paddingHorizontal: Spacing.xs, marginBottom: Spacing.lg },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  avatar: { width: 28, height: 28, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: Palette.surfaceAlt },
  caption: { padding: Spacing.md, paddingBottom: Spacing.sm },
  stylistCredit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  engageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  engageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

