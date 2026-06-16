import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchPublicFeed, searchUsers } from '@/lib/public';
import { useCenteredContent, useIsDesktop } from '@/hooks/use-responsive';
import type { PublicPost, UserSearchResult } from '@/types';

export default function ExploreScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const centered = useCenteredContent(1040);
  const [feed, setFeed] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchActive = query.trim().length >= 2;

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

  // Debounced user search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchUsers(q);
      setResults(found);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Txt variant="title">Explore</Txt>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people by name or @username"
            placeholderTextColor={Palette.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <IconSymbol name="xmark" size={16} color={Palette.textMuted} />
            </Pressable>
          ) : null}
        </View>
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
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.userAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                    <IconSymbol name="person.fill" size={18} color={Palette.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Txt variant="body" numberOfLines={1}>
                      {u.displayName || u.username || 'Sif user'}
                    </Txt>
                    {u.isStylist ? (
                      <View style={styles.stylistBadge}>
                        <Txt variant="caption" color={Palette.black}>
                          Stylist
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                  {u.username ? (
                    <Txt variant="caption" color={Palette.textMuted}>
                      @{u.username}
                      {u.privacy !== 'public' ? ' · private' : ''}
                    </Txt>
                  ) : null}
                </View>
                <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
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
          <View style={styles.center}>
            <IconSymbol name="safari" size={48} color={Palette.textDim} />
            <Txt variant="heading" style={styles.emptyTitle}>
              Nothing here yet
            </Txt>
            <Txt variant="label" style={styles.emptyText}>
              Public posts from the community will show up here. Make your profile public and post a
              cut to be the first!
            </Txt>
          </View>
        ) : (
          <View style={styles.grid}>
            {feed.map((post) => (
              <View
                key={post.id}
                style={[styles.cell, { width: isDesktop ? '33.333%' : '100%' }]}>
                <Pressable style={styles.card} onPress={() => router.push(`/p/${post.id}`)}>
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
                </Pressable>
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
  if (!username) return <View style={styles.userRow}>{children}</View>;
  return (
    <Link href={`/u/${username}`} asChild>
      <Pressable style={styles.userRow}>{children}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 2 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  userAvatar: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stylistBadge: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl * 2 },
  emptyTitle: { color: Palette.textMuted },
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
  caption: { padding: Spacing.md },
});
