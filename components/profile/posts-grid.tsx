import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { primaryPhotoUri } from '@/lib/photos';
import { useHaircuts } from '@/store/haircuts';
import { usePosts } from '@/store/posts';

export function PostsGrid() {
  const router = useRouter();
  const { posts } = usePosts();
  const { getById } = useHaircuts();

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
});
