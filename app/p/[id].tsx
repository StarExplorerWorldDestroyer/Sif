import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { addComment, deleteComment, fetchComments, setPostLike } from '@/lib/engagement';
import { fetchPublicPost } from '@/lib/public';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import type { PostComment, PublicPost } from '@/types';

export default function PublicPostScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const centered = useCenteredContent(560);

  const [post, setPost] = useState<PublicPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!id) return;
    setComments(await fetchComments(id));
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [p] = await Promise.all([fetchPublicPost(id), loadComments()]);
      if (active) {
        setPost(p);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, loadComments]);

  const toggleLike = useCallback(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    setPost((prev) => {
      if (!prev) return prev;
      const like = !prev.likedByMe;
      setPostLike(prev.id, like).catch(() => {});
      return {
        ...prev,
        likedByMe: like,
        likeCount: Math.max(0, prev.likeCount + (like ? 1 : -1)),
      };
    });
  }, [user, router]);

  const submitComment = useCallback(async () => {
    const text = draft.trim();
    if (!text || !post || posting) return;
    setPosting(true);
    const newId = await addComment(post.id, text);
    if (newId) {
      setDraft('');
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
      await loadComments();
    }
    setPosting(false);
  }, [draft, post, posting, loadComments]);

  const removeComment = useCallback(
    async (commentId: string) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev));
      await deleteComment(commentId);
    },
    [],
  );

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
        <ScrollView contentContainerStyle={centered ?? undefined}>
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

          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn} onPress={toggleLike} hitSlop={8}>
              <IconSymbol
                name={post.likedByMe ? 'heart.fill' : 'heart'}
                size={24}
                color={post.likedByMe ? Palette.accent : Palette.text}
              />
            </Pressable>
            <View style={styles.actionBtn}>
              <IconSymbol name="bubble.right" size={22} color={Palette.text} />
            </View>
          </View>

          <View style={styles.body}>
            {post.likeCount > 0 ? (
              <Txt variant="label" color={Palette.text}>
                {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
              </Txt>
            ) : null}
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
            {post.stylist ? (
              <Pressable
                style={styles.stylistRow}
                onPress={() =>
                  post.stylist?.username
                    ? router.push(`/u/${post.stylist.username}`)
                    : undefined
                }>
                <IconSymbol name="scissors" size={14} color={Palette.textMuted} />
                <Txt variant="label" color={Palette.text}>
                  Cut by {post.stylist.displayName || `@${post.stylist.username}` || 'stylist'}
                </Txt>
              </Pressable>
            ) : null}
            <Txt variant="caption">{formatDate(post.createdAt)}</Txt>
          </View>

          <View style={styles.comments}>
            <Txt variant="label" color={Palette.text} style={styles.commentsTitle}>
              Comments{post.commentCount > 0 ? ` · ${post.commentCount}` : ''}
            </Txt>

            {comments.length === 0 ? (
              <Txt variant="caption" style={styles.muted}>
                No comments yet.{user ? ' Be the first.' : ''}
              </Txt>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  {c.author.avatarUrl ? (
                    <Image source={{ uri: c.author.avatarUrl }} style={styles.commentAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
                      <IconSymbol name="person.fill" size={14} color={Palette.textMuted} />
                    </View>
                  )}
                  <View style={styles.commentBody}>
                    <Txt variant="body">
                      <Pressable
                        onPress={() =>
                          c.author.username ? router.push(`/u/${c.author.username}`) : undefined
                        }>
                        <Txt variant="label" color={Palette.text}>
                          {c.author.username ? `@${c.author.username}` : c.author.displayName}{' '}
                        </Txt>
                      </Pressable>
                      {c.body}
                    </Txt>
                    <Txt variant="caption">{formatDate(c.createdAt)}</Txt>
                  </View>
                  {user?.id === c.author.id ? (
                    <Pressable onPress={() => removeComment(c.id)} hitSlop={8}>
                      <IconSymbol name="trash" size={16} color={Palette.textDim} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </View>

          {user ? (
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add a comment…"
                placeholderTextColor={Palette.textDim}
                style={styles.input}
                multiline
                onSubmitEditing={submitComment}
              />
              <Pressable
                onPress={submitComment}
                disabled={!draft.trim() || posting}
                hitSlop={8}
                style={styles.send}>
                <Txt
                  variant="label"
                  color={!draft.trim() || posting ? Palette.textDim : Palette.accent}>
                  Post
                </Txt>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.signinPrompt} onPress={() => router.push('/login')}>
              <Txt variant="label" color={Palette.accent}>
                Sign in to like and comment
              </Txt>
            </Pressable>
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md, gap: Spacing.sm },
  caption: { lineHeight: 22 },
  stylistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  comments: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  commentsTitle: { marginBottom: Spacing.xs },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  commentBody: { flex: 1, gap: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  input: {
    flex: 1,
    color: Palette.text,
    fontSize: 15,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 120,
  },
  send: { paddingHorizontal: Spacing.sm },
  signinPrompt: { alignItems: 'center', paddingVertical: Spacing.lg },
});
