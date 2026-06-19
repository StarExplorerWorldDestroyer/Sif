import { AppImage as Image } from '@/components/ui/app-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { getOrCreateConversation, sendMessage } from '@/lib/messages';
import { fetchPublicPost, searchUsers } from '@/lib/public';
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const searchActive = query.trim().length >= 2;

  useEffect(() => {
    if (!postId) return;
    fetchPublicPost(postId).then(setPost);
  }, [postId]);

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
      setResults(found.filter((u) => u.id !== user?.id));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, user?.id]);

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
    <Pressable style={styles.row} onPress={onPress} disabled={busy}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.placeholder]}>
          <IconSymbol name="person.fill" size={18} color={Palette.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Txt variant="body" numberOfLines={1}>
          {user.displayName || user.username || 'Sif user'}
        </Txt>
        {user.username ? (
          <Txt variant="caption" color={Palette.textMuted}>
            @{user.username}
          </Txt>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={Palette.accent} size="small" />
      ) : (
        <IconSymbol name="paperplane.fill" size={18} color={Palette.accent} />
      )}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 2 },
  sectionLabel: { letterSpacing: 1, marginTop: Spacing.sm },
  emptyText: { textAlign: 'center', paddingTop: Spacing.lg, color: Palette.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
});
