import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

  function openUser(u: UserSearchResult) {
    if (u.username) router.push(`/u/${u.username}`);
  }

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
                  <Pressable style={styles.person} onPress={() => openUser(u)}>
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
                  </Pressable>
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
              <Pressable key={u.id} style={styles.row} onPress={() => openUser(u)}>
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
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
