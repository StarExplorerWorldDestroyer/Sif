import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchPublicFeed } from '@/lib/public';
import { useCenteredContent, useIsDesktop } from '@/hooks/use-responsive';
import type { PublicPost } from '@/types';

export default function ExploreScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const centered = useCenteredContent(1040);
  const [feed, setFeed] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Txt variant="title">Explore</Txt>
      </View>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
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
