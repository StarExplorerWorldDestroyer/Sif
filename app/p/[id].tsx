import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { fetchPublicPost } from '@/lib/public';
import type { PublicPost } from '@/types';

export default function PublicPostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState<PublicPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const p = await fetchPublicPost(id);
      if (active) {
        setPost(p);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const handle = post?.author.username || post?.author.displayName || 'Sif user';

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
      ) : !post ? (
        <View style={styles.center}>
          <Txt variant="label" style={styles.muted}>
            This post isn&apos;t available.
          </Txt>
        </View>
      ) : (
        <ScrollView>
          <Pressable
            style={styles.authorRow}
            onPress={() =>
              post.author.username ? router.push(`/u/${post.author.username}`) : undefined
            }>
            {post.author.avatarUrl ? (
              <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
              </View>
            )}
            <Txt variant="body">{handle}</Txt>
          </Pressable>

          <Image source={{ uri: post.photoUrl }} style={styles.photo} contentFit="cover" />

          <View style={styles.body}>
            {post.caption ? (
              <Txt variant="body" style={styles.caption}>
                <Txt variant="body">{handle} </Txt>
                {post.caption}
              </Txt>
            ) : null}
            {post.cutType ? (
              <Txt variant="label" color={Palette.accent}>
                {post.cutType}
              </Txt>
            ) : null}
            <Txt variant="caption">{formatDate(post.createdAt)}</Txt>
          </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  muted: { textAlign: 'center', color: Palette.textMuted },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  avatar: { width: 32, height: 32, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: Palette.surfaceAlt },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  caption: { lineHeight: 22 },
});
