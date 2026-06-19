import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { getOrCreateConversation } from '@/lib/messages';
import { searchUsers } from '@/lib/public';
import { useAuth } from '@/store/auth';
import type { UserSearchResult } from '@/types';

export default function NewMessageScreen() {
  const router = useRouter();
  const centered = useCenteredContent(680);
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);

  const searchActive = query.trim().length >= 2;

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

  const start = async (other: UserSearchResult) => {
    if (starting) return;
    setStarting(true);
    const cid = await getOrCreateConversation(other.id);
    setStarting(false);
    if (!cid) return;
    router.replace(`/messages/${cid}?other=${other.id}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">New message</Txt>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.searchWrap, centered]}>
        <View style={styles.searchBox}>
          <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people by name or @username"
            placeholderTextColor={Palette.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <IconSymbol name="xmark" size={16} color={Palette.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {starting ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : !searchActive ? (
        <EmptyState
          icon="bubble.right"
          title="Start a conversation"
          subtitle="Search for someone by name or @username to send them a message."
        />
      ) : (
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
              <Pressable key={u.id} style={styles.row} onPress={() => start(u)}>
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
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
                <IconSymbol name="bubble.right" size={18} color={Palette.textDim} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxl },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  emptyText: { textAlign: 'center', paddingTop: Spacing.xl, color: Palette.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  avatar: { width: 48, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stylistBadge: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
