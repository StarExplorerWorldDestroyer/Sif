import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchLikers } from '@/lib/engagement';
import { useCenteredContent } from '@/hooks/use-responsive';
import type { UserSearchResult } from '@/types';

export default function LikesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const centered = useCenteredContent(640);
  const [likers, setLikers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const rows = await fetchLikers(id);
      if (active) {
        setLikers(rows);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Likes</Txt>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : likers.length === 0 ? (
        <View style={styles.center}>
          <IconSymbol name="heart" size={32} color={Palette.textDim} />
          <Txt variant="label" color={Palette.textMuted}>
            No likes yet.
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
          {likers.map((u) => (
            <UserRowLink key={u.id} username={u.username}>
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
                  </Txt>
                ) : null}
              </View>
              {u.username ? <IconSymbol name="chevron.right" size={16} color={Palette.textDim} /> : null}
            </UserRowLink>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function UserRowLink({ username, children }: { username: string | null; children: ReactNode }) {
  if (!username) return <View style={styles.row}>{children}</View>;
  return (
    <Link href={`/u/${username}`} asChild>
      <Pressable style={styles.row}>{children}</Pressable>
    </Link>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stylistBadge: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
});
