import { AppImage as Image } from '@/components/ui/app-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ModerationMenu } from '@/components/ui/moderation-menu';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { submitOnEnter } from '@/lib/keyboard';
import {
  addComment,
  deleteComment,
  editComment,
  fetchComments,
  fetchLikers,
  setPostLike,
} from '@/lib/engagement';
import { fetchPublicPost } from '@/lib/public';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useAuth } from '@/store/auth';
import type { PostComment, PublicPost, UserSearchResult } from '@/types';

type ReplyTarget = { id: string; handle: string };

export default function PublicPostScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const centered = useCenteredContent(560);

  const [post, setPost] = useState<PublicPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [likers, setLikers] = useState<UserSearchResult[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const loadComments = useCallback(async () => {
    if (!id) return;
    setComments(await fetchComments(id));
  }, [id]);

  const loadLikers = useCallback(async () => {
    if (!id) return;
    setLikers(await fetchLikers(id));
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [p] = await Promise.all([fetchPublicPost(id), loadComments(), loadLikers()]);
      if (active) {
        setPost(p);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, loadComments, loadLikers]);

  const toggleLike = useCallback(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    setPost((prev) => {
      if (!prev) return prev;
      const like = !prev.likedByMe;
      setPostLike(prev.id, like)
        .then(loadLikers)
        .catch(() => {});
      return {
        ...prev,
        likedByMe: like,
        likeCount: Math.max(0, prev.likeCount + (like ? 1 : -1)),
      };
    });
  }, [user, router, loadLikers]);

  const submitComment = useCallback(async () => {
    const text = draft.trim();
    if (!text || !post || posting) return;
    setPosting(true);
    const newId = await addComment(post.id, text, replyTo?.id ?? null);
    if (newId) {
      setDraft('');
      setReplyTo(null);
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
      await loadComments();
    }
    setPosting(false);
  }, [draft, post, posting, replyTo, loadComments]);

  const removeComment = useCallback(
    async (commentId: string) => {
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parentId !== commentId),
      );
      setPost((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev));
      await deleteComment(commentId);
      await loadComments();
    },
    [loadComments],
  );

  const startReply = useCallback((c: PostComment) => {
    if (!user) {
      router.push('/login');
      return;
    }
    const handle = c.author.username ? `@${c.author.username}` : c.author.displayName;
    setReplyTo({ id: c.parentId ?? c.id, handle });
    setEditingId(null);
    inputRef.current?.focus();
  }, [user, router]);

  const startEdit = useCallback((c: PostComment) => {
    setEditingId(c.id);
    setEditDraft(c.body);
    setReplyTo(null);
  }, []);

  const saveEdit = useCallback(async () => {
    const text = editDraft.trim();
    if (!editingId || !text) return;
    const id = editingId;
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, body: text } : c)));
    setEditingId(null);
    await editComment(id, text);
  }, [editingId, editDraft]);

  // Group into top-level comments with their (one-level) replies, preserving order.
  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    const repliesByParent = new Map<string, PostComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = repliesByParent.get(c.parentId) ?? [];
        arr.push(c);
        repliesByParent.set(c.parentId, arr);
      }
    }
    return roots.map((root) => ({ root, replies: repliesByParent.get(root.id) ?? [] }));
  }, [comments]);

  const likeSummary = useMemo(() => {
    if (!post || post.likeCount <= 0) return null;
    const first = likers[0];
    const firstName = first ? (first.username ? `@${first.username}` : first.displayName) : null;
    if (firstName) {
      if (post.likeCount === 1) return `Liked by ${firstName}`;
      const others = post.likeCount - 1;
      return `Liked by ${firstName} and ${others} ${others === 1 ? 'other' : 'others'}`;
    }
    return `${post.likeCount} ${post.likeCount === 1 ? 'like' : 'likes'}`;
  }, [post, likers]);

  const handle = post?.author.username || post?.author.displayName || 'Sif user';

  const renderComment = (c: PostComment, isReply: boolean) => {
    const authorName = c.author.username ? `@${c.author.username}` : c.author.displayName;
    const mine = user?.id === c.author.id;
    return (
      <View key={c.id} style={[styles.commentRow, isReply && styles.replyRow]}>
        {c.author.avatarUrl ? (
          <Image source={{ uri: c.author.avatarUrl }} style={styles.commentAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
            <IconSymbol name="person.fill" size={14} color={Palette.textMuted} />
          </View>
        )}
        <View style={styles.commentBody}>
          {editingId === c.id ? (
            <View style={styles.editBox}>
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                style={styles.input}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <Pressable onPress={() => setEditingId(null)} hitSlop={8}>
                  <Txt variant="label" color={Palette.textMuted}>
                    Cancel
                  </Txt>
                </Pressable>
                <Pressable onPress={saveEdit} disabled={!editDraft.trim()} hitSlop={8}>
                  <Txt variant="label" color={editDraft.trim() ? Palette.accent : Palette.textDim}>
                    Save
                  </Txt>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Txt variant="body">
                <Pressable
                  onPress={() =>
                    c.author.username ? router.push(`/u/${c.author.username}`) : undefined
                  }>
                  <Txt variant="label" color={Palette.text}>
                    {authorName}{' '}
                  </Txt>
                </Pressable>
                {c.body}
              </Txt>
              <View style={styles.commentMeta}>
                <Txt variant="caption">{formatDate(c.createdAt)}</Txt>
                {!isReply ? (
                  <Pressable onPress={() => startReply(c)} hitSlop={6}>
                    <Txt variant="caption" color={Palette.textMuted}>
                      Reply
                    </Txt>
                  </Pressable>
                ) : null}
                {mine ? (
                  <Pressable onPress={() => startEdit(c)} hitSlop={6}>
                    <Txt variant="caption" color={Palette.textMuted}>
                      Edit
                    </Txt>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
        {mine && editingId !== c.id ? (
          <Pressable
            onPress={() => removeComment(c.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete comment">
            <IconSymbol name="trash" size={16} color={Palette.textDim} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading" color={Palette.accent}>
          Sif
        </Txt>
        {post && user && post.author.id !== user.id ? (
          <ModerationMenu
            userId={post.author.id}
            username={post.author.username}
            content={{ type: 'post', id: post.id }}
            onBlocked={() => router.back()}
          />
        ) : (
          <View style={{ width: 26 }} />
        )}
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
            <Pressable
              style={styles.actionBtn}
              onPress={toggleLike}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'}>
              <IconSymbol
                name={post.likedByMe ? 'heart.fill' : 'heart'}
                size={24}
                color={post.likedByMe ? Palette.accent : Palette.text}
              />
            </Pressable>
            <View style={styles.actionBtn}>
              <IconSymbol name="bubble.right" size={22} color={Palette.text} />
            </View>
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(user ? `/messages/share?post=${post.id}` : '/login')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share post">
              <IconSymbol name="paperplane.fill" size={22} color={Palette.text} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {likeSummary ? (
              <Pressable onPress={() => router.push(`/likes/${post.id}`)} hitSlop={6}>
                <Txt variant="label" color={Palette.text}>
                  {likeSummary}
                </Txt>
              </Pressable>
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

            {threads.length === 0 ? (
              <Txt variant="caption" style={styles.muted}>
                No comments yet.{user ? ' Be the first.' : ''}
              </Txt>
            ) : (
              threads.map(({ root, replies }) => (
                <View key={root.id} style={styles.thread}>
                  {renderComment(root, false)}
                  {replies.map((r) => renderComment(r, true))}
                </View>
              ))
            )}
          </View>

          {user ? (
            <View>
              {replyTo ? (
                <View style={styles.replyBanner}>
                  <Txt variant="caption" color={Palette.textMuted}>
                    Replying to {replyTo.handle}
                  </Txt>
                  <Pressable
                    onPress={() => setReplyTo(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel reply">
                    <IconSymbol name="xmark" size={14} color={Palette.textMuted} />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.composer}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                  placeholderTextColor={Palette.textDim}
                  style={styles.input}
                  multiline
                  onSubmitEditing={submitComment}
                  onKeyPress={submitOnEnter(submitComment)}
                />
                <Pressable
                  onPress={submitComment}
                  disabled={!draft.trim() || posting}
                  hitSlop={8}
                  style={styles.send}>
                  <Txt
                    variant="label"
                    color={!draft.trim() || posting ? Palette.textDim : Palette.accent}>
                    {replyTo ? 'Reply' : 'Post'}
                  </Txt>
                </Pressable>
              </View>
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
  thread: { gap: Spacing.md },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  replyRow: { marginLeft: Spacing.xl, paddingLeft: Spacing.sm },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  commentBody: { flex: 1, gap: 2 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  editBox: { gap: Spacing.sm },
  editActions: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'flex-end' },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
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
