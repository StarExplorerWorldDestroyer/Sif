import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useSocial } from '@/store/social';
import type { UserSearchResult } from '@/types';

export default function ConnectionsScreen() {
  const router = useRouter();
  const centered = useCenteredContent(640);
  const { incomingRequests, connectionList, acceptConnection, removeConnection, loading } = useSocial();

  const [incoming, setIncoming] = useState<UserSearchResult[]>([]);
  const [connected, setConnected] = useState<UserSearchResult[]>([]);
  const [resolving, setResolving] = useState(true);

  const refresh = useCallback(async () => {
    setResolving(true);
    const [inc, conn] = await Promise.all([incomingRequests(), connectionList()]);
    setIncoming(inc);
    setConnected(conn);
    setResolving(false);
  }, [incomingRequests, connectionList]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Connections</Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading || resolving ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
          {incoming.length > 0 ? (
            <>
              <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
                REQUESTS
              </Txt>
              {incoming.map((u) => (
                <View key={u.id} style={styles.row}>
                  <PersonLink username={u.username} style={styles.person}>
                    <Avatar uri={u.avatarUrl} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="body" numberOfLines={1}>
                        {u.displayName || u.username || 'Sif user'}
                      </Txt>
                      {u.username ? (
                        <Txt variant="caption" color={Palette.textMuted}>
                          @{u.username}
                        </Txt>
                      ) : null}
                    </View>
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
              <PersonLink key={u.id} username={u.username} style={styles.row}>
                <View style={styles.person}>
                  <Avatar uri={u.avatarUrl} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" numberOfLines={1}>
                      {u.displayName || u.username || 'Sif user'}
                    </Txt>
                    {u.username ? (
                      <Txt variant="caption" color={Palette.textMuted}>
                        @{u.username}
                      </Txt>
                    ) : null}
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
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

function Avatar({ uri }: { uri: string }) {
  if (uri) return <Image source={{ uri }} style={styles.avatar} contentFit="cover" />;
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <IconSymbol name="person.fill" size={18} color={Palette.textMuted} />
    </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm, letterSpacing: 1 },
  empty: { color: Palette.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
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
