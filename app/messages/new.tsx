import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { UserResultRow } from '@/components/ui/user-result-row';
import { UserSearchBox } from '@/components/ui/user-search-box';
import { Palette, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useUserSearch } from '@/hooks/use-user-search';
import { getOrCreateConversation } from '@/lib/messages';
import { useAuth } from '@/store/auth';
import type { UserSearchResult } from '@/types';

export default function NewMessageScreen() {
  const router = useRouter();
  const centered = useCenteredContent(680);
  const { user } = useAuth();

  const { query, setQuery, results, searching, active: searchActive, clear } = useUserSearch({
    excludeId: user?.id,
  });
  const [starting, setStarting] = useState(false);

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
        <UserSearchBox value={query} onChangeText={setQuery} onClear={clear} autoFocus />
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
              <Pressable key={u.id} onPress={() => start(u)}>
                <UserResultRow
                  user={u}
                  trailing={<IconSymbol name="bubble.right" size={18} color={Palette.textDim} />}
                />
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  emptyText: { textAlign: 'center', paddingTop: Spacing.xl, color: Palette.textMuted },
});
