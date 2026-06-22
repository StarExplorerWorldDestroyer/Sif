import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { UserResultRow } from '@/components/ui/user-result-row';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { fetchBlockedUsers, unblockUser, type BlockedUser } from '@/lib/moderation';
import { useFeedback } from '@/store/feedback';

export default function BlockedScreen() {
  const centered = useCenteredContent();
  const { toast } = useFeedback();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setUsers(await fetchBlockedUsers());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onUnblock = async (u: BlockedUser) => {
    const ok = await unblockUser(u.id);
    if (ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast(`Unblocked ${u.username ? '@' + u.username : u.displayName}.`, { tone: 'success' });
    } else {
      toast('Could not unblock this account.', { tone: 'error' });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Blocked accounts" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : users.length === 0 ? (
        <EmptyState
          icon="hand.raised.fill"
          title="No blocked accounts"
          subtitle="People you block can't message you or see your profile and posts, and you won't see theirs."
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.list, centered ?? undefined]}
          renderItem={({ item }) => (
            <UserResultRow
              user={{
                id: item.id,
                username: item.username,
                displayName: item.displayName,
                avatarUrl: item.avatarUrl,
                privacy: 'public',
                isStylist: false,
              }}
              showPrivacy={false}
              trailing={
                <Pressable
                  style={styles.unblock}
                  onPress={() => onUnblock(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${item.displayName}`}>
                  <Txt variant="label" color={Palette.accent}>
                    Unblock
                  </Txt>
                </Pressable>
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  unblock: {
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
});
