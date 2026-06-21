import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { UserResultRow } from '@/components/ui/user-result-row';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useRefresh } from '@/hooks/use-refresh';
import { useSocial } from '@/store/social';
import type { UserSearchResult } from '@/types';

export default function ConnectionsScreen() {
  const centered = useCenteredContent(640);
  const { incomingRequests, connectionList, acceptConnection, removeConnection, loading } = useSocial();

  const [incoming, setIncoming] = useState<UserSearchResult[]>([]);
  const [connected, setConnected] = useState<UserSearchResult[]>([]);
  const [resolving, setResolving] = useState(true);

  const fetchData = useCallback(async () => {
    const [inc, conn] = await Promise.all([incomingRequests(), connectionList()]);
    setIncoming(inc);
    setConnected(conn);
  }, [incomingRequests, connectionList]);

  const refresh = useCallback(async () => {
    setResolving(true);
    await fetchData();
    setResolving(false);
  }, [fetchData]);

  const { refreshing, onRefresh } = useRefresh(fetchData);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Connections" />

      {loading || resolving ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />
          }>
          {incoming.length > 0 ? (
            <>
              <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
                REQUESTS
              </Txt>
              {incoming.map((u) => (
                <View key={u.id} style={styles.requestRow}>
                  <PersonLink username={u.username} style={styles.person}>
                    <UserResultRow user={u} divider={false} showPrivacy={false} />
                  </PersonLink>
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.smallBtn, styles.filled]}
                      onPress={async () => {
                        await acceptConnection(u.id);
                        refresh();
                      }}>
                      <Txt variant="caption" color={Palette.black}>
                        Accept
                      </Txt>
                    </Pressable>
                    <Pressable
                      style={[styles.smallBtn, styles.outline]}
                      onPress={async () => {
                        await removeConnection(u.id);
                        refresh();
                      }}>
                      <Txt variant="caption" color={Palette.textMuted}>
                        Decline
                      </Txt>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
            CONNECTIONS
          </Txt>
          {connected.length === 0 ? (
            <Txt variant="label" style={styles.empty}>
              No connections yet. Find people on the Explore tab and send a request.
            </Txt>
          ) : (
            connected.map((u) => (
              <PersonLink key={u.id} username={u.username}>
                <UserResultRow
                  user={u}
                  showPrivacy={false}
                  trailing={<IconSymbol name="chevron.right" size={16} color={Palette.textDim} />}
                />
              </PersonLink>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * A tappable person row that navigates to their public profile. Uses Expo
 * Router's Link (a real anchor on web) so taps register reliably on mobile
 * browsers, falling back to a plain View when there's no username to link to.
 */
function PersonLink({
  username,
  style,
  children,
}: {
  username: string | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (!username) return <View style={style}>{children}</View>;
  return (
    <Link href={`/u/${username}`} asChild>
      <Pressable style={style}>{children}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm, letterSpacing: 1 },
  empty: { color: Palette.textMuted },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  person: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  smallBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: Palette.accent },
  outline: { borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
});
