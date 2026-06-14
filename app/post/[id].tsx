import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { primaryPhotoUri } from '@/lib/photos';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import { useHaircuts } from '@/store/haircuts';
import { usePosts } from '@/store/posts';
import { useProfile } from '@/store/profile';

export default function PostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById: getPost, deletePost, updatePost } = usePosts();
  const { getById: getHaircut } = useHaircuts();
  const { profile } = useProfile();
  const { user } = useAuth();
  const centered = useCenteredContent(560);

  const post = getPost(id);
  const haircut = post ? getHaircut(post.haircutId) : undefined;

  const handle = profile?.username || profile?.displayName || user?.email?.split('@')[0] || 'you';

  if (!post || !haircut) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <IconSymbol name="chevron.left" size={26} color={Palette.text} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Txt variant="label">This post is no longer available.</Txt>
        </View>
      </SafeAreaView>
    );
  }

  function editCaption() {
    Alert.prompt(
      'Edit caption',
      undefined,
      (text) => updatePost(post!.id, text ?? ''),
      'plain-text',
      post!.caption,
    );
  }

  function confirmDelete() {
    Alert.alert('Delete post?', 'This removes it from your profile. The haircut stays saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePost(post!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Post</Txt>
        <View style={styles.headerActions}>
          <Pressable onPress={editCaption} hitSlop={8}>
            <IconSymbol name="pencil" size={20} color={Palette.text} />
          </Pressable>
          <Pressable onPress={confirmDelete} hitSlop={8}>
            <IconSymbol name="trash" size={20} color={Palette.accent} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={centered ?? undefined}>
        <View style={styles.authorRow}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
            </View>
          )}
          <Txt variant="body">{handle}</Txt>
        </View>

        <Image source={{ uri: primaryPhotoUri(haircut) }} style={styles.photo} contentFit="cover" />

        <View style={styles.body}>
          <View style={styles.actions}>
            <IconSymbol name="heart" size={24} color={Palette.text} />
            <IconSymbol name="bubble.right" size={22} color={Palette.text} />
            <IconSymbol name="square.and.arrow.up" size={22} color={Palette.text} />
          </View>

          {post.caption ? (
            <Txt variant="body" style={styles.caption}>
              <Txt variant="body" color={Palette.text}>
                {handle}{' '}
              </Txt>
              {post.caption}
            </Txt>
          ) : null}

          <Pressable
            style={styles.detailLink}
            onPress={() => router.push(`/haircut/${haircut.id}`)}>
            <Txt variant="label" color={Palette.accent}>
              {haircut.cutType} · view haircut details
            </Txt>
            <IconSymbol name="chevron.right" size={14} color={Palette.accent} />
          </Pressable>

          <Txt variant="caption" style={styles.date}>
            {formatDate(post.createdAt)}
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerActions: { flexDirection: 'row', gap: Spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  body: { padding: Spacing.lg, gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.lg },
  caption: { lineHeight: 22 },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  date: { marginTop: Spacing.xs },
});
