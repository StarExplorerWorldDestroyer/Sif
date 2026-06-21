import { AppImage as Image } from '@/components/ui/app-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { UserResultRow } from '@/components/ui/user-result-row';
import { UserSearchBox } from '@/components/ui/user-search-box';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useUserSearch } from '@/hooks/use-user-search';
import { getOrCreateConversation, sendMessage } from '@/lib/messages';
import { fetchPublicPost } from '@/lib/public';
import { useAuth } from '@/store/auth';
import { useMessages } from '@/store/messages';
import type { PublicPost, UserSearchResult } from '@/types';

export default function SharePostScreen() {
  const router = useRouter();
  const centered = useCenteredContent(680);
  const { user } = useAuth();
  const { conversations } = useMessages();
  const { post: postId } = useLocalSearchParams<{ post: string }>();

  const [post, setPost] = useState<PublicPost | null>(null);
  const [note, setNote] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const { query, setQuery, results, searching, active: searchActive, clear } = useUserSearch({
    excludeId: user?.id,
  });

  useEffect(() => {
    if (!postId) return;
    fetchPublicPost(postId).then(setPost);
  }, [postId]);

  const shareWith = async (otherId: string) => {
    if (!postId || sendingTo) return;
    setSendingTo(otherId);
    const cid = await getOrCreateConversation(otherId);
    if (!cid) {
      setSendingTo(null);
      return;
    }
    await sendMessage(cid, note.trim(), null, postId);
    setSendingTo(null);
    router.replace(`/messages/${cid}?other=${otherId}`);
  };

  const recents = conversations.slice(0, 8);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Share post</Txt>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, centered]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {post ? (
          <View style={styles.postPreview}>
            {post.photoUrl ? (
              <Image source={{ uri: post.photoUrl }} style={styles.postThumb} contentFit="cover" />
            ) : (
              <View style={[styles.postThumb, styles.placeholder]}>
                <IconSymbol name="scissors" size={18} color={Palette.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Txt variant="body" numberOfLines={1}>
                {post.author.username ? `@${post.author.username}` : post.author.displayName || 'Sif user'}
              </Txt>
              {post.caption ? (
                <Txt variant="caption" color={Palette.textMuted} numberOfLines={2}>
                  {post.caption}
                </Txt>
              ) : null}
            </View>
          </View>
        ) : null}

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a message (optional)"
          placeholderTextColor={Palette.textDim}
          style={styles.note}
          multiline
        />

        <UserSearchBox value={query} onChangeText={setQuery} onClear={clear} />

        {searchActive ? (
          searching ? (
            <View style={styles.center}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : results.length === 0 ? (
            <Txt variant="label" style={styles.emptyText}>
              No people found for “{query.trim()}”.
            </Txt>
          ) : (
            results.map((u) => (
              <RecipientRow
                key={u.id}
                user={u}
                busy={sendingTo === u.id}
                onPress={() => shareWith(u.id)}
              />
            ))
          )
        ) : recents.length > 0 ? (
          <>
            <Txt variant="caption" color={Palette.textMuted} style={styles.sectionLabel}>
              RECENT
            </Txt>
            {recents.map((c) => (
              <RecipientRow
                key={c.id}
                user={c.other}
                busy={sendingTo === c.other.id}
                onPress={() => shareWith(c.other.id)}
              />
            ))}
          </>
        ) : (
          <Txt variant="label" style={styles.emptyText}>
            Search for someone to share this post with.
          </Txt>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecipientRow({
  user,
  busy,
  onPress,
}: {
  user: UserSearchResult;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy}>
      <UserResultRow
        user={user}
        showPrivacy={false}
        trailing={
          busy ? (
            <ActivityIndicator color={Palette.accent} size="small" />
          ) : (
            <IconSymbol name="paperplane.fill" size={18} color={Palette.accent} />
          )
        }
      />
    </Pressable>
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
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  center: { paddingVertical: Spacing.xl, alignItems: 'center' },
  postPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
  },
  postThumb: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Palette.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  note: {
    color: Palette.text,
    fontSize: 15,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  sectionLabel: { letterSpacing: 1, marginTop: Spacing.sm },
  emptyText: { textAlign: 'center', paddingTop: Spacing.lg, color: Palette.textMuted },
});
