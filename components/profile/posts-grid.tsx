import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchEngagementCounts, type EngagementCount } from '@/lib/engagement';
import { primaryPhotoUri } from '@/lib/photos';
import { useHaircuts } from '@/store/haircuts';
import { usePosts } from '@/store/posts';

export function PostsGrid() {
  const router = useRouter();
  const { posts } = usePosts();
  const { getById } = useHaircuts();
  const [counts, setCounts] = useState<Record<string, EngagementCount>>({});

  const postKey = posts.map((p) => p.id).join(',');
  useEffect(() => {
    if (posts.length === 0) {
      setCounts({});
      return;
    }
    let active = true;
    fetchEngagementCounts(posts.map((p) => p.id)).then((c) => {
      if (active) setCounts(c);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postKey]);

  return (
    <View>
      <Txt variant="label" color={Palette.textMuted} style={styles.title}>
        HIGHLIGHTS
      </Txt>
      <View style={styles.grid}>
        <Pressable style={styles.cell} onPress={() => router.push('/post/new')}>
          <View style={[styles.tile, styles.newTile]}>
            <IconSymbol name="plus" size={28} color={Palette.accent} />
          </View>
        </Pressable>

        {posts.map((post) => {
          const haircut = getById(post.haircutId);
          if (!haircut) return null;
          const c = counts[post.id];
          return (
            <Pressable
              key={post.id}
              style={styles.cell}
              onPress={() => router.push(`/post/${post.id}`)}>
              <Image
                source={{ uri: primaryPhotoUri(haircut) }}
                style={styles.tile}
                contentFit="cover"
              />
              {c && (c.likeCount > 0 || c.commentCount > 0) ? (
                <View style={styles.tileStats}>
                  {c.likeCount > 0 ? (
                    <View style={styles.tileStat}>
                      <IconSymbol name="heart.fill" size={12} color={Palette.text} />
                      <Txt variant="caption" color={Palette.text}>
                        {c.likeCount}
                      </Txt>
                    </View>
                  ) : null}
                  {c.commentCount > 0 ? (
                    <View style={styles.tileStat}>
                      <IconSymbol name="bubble.right" size={12} color={Palette.text} />
                      <Txt variant="caption" color={Palette.text}>
                        {c.commentCount}
                      </Txt>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: Spacing.sm, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', aspectRatio: 1, padding: 1 },
  tile: { flex: 1, backgroundColor: Palette.surfaceAlt },
  newTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.accent,
    borderStyle: 'dashed',
    backgroundColor: Palette.surface,
  },
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
