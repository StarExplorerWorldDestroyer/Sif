import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { HaircutCard } from '@/components/cuts/haircut-card';
import { StatsPanel } from '@/components/cuts/stats-panel';
import { TimeFilter } from '@/components/cuts/time-filter';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useHaircuts } from '@/store/haircuts';
import { useNotifications } from '@/store/notifications';
import { useCenteredContent } from '@/hooks/use-responsive';
import { computeStats, filterByRange, type TimeRange } from '@/lib/format';

export default function CutsScreen() {
  const router = useRouter();
  const { haircuts, pending, loading } = useHaircuts();
  const { unreadCount } = useNotifications();
  const [range, setRange] = useState<TimeRange>('All');
  const centered = useCenteredContent();

  const filtered = useMemo(() => filterByRange(haircuts, range), [haircuts, range]);
  const stats = useMemo(() => computeStats(filtered), [filtered]);

  return (
    <Screen padded={false}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, centered]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Txt variant="title">Sif</Txt>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.bellButton}
                  hitSlop={8}
                  onPress={() => router.push('/notifications')}>
                  <IconSymbol name="bell" size={22} color={Palette.text} />
                  {unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Txt variant="caption" color={Palette.black} style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Txt>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  style={styles.addButton}
                  hitSlop={8}
                  onPress={() => router.push('/add')}>
                  <IconSymbol name="plus" size={22} color={Palette.black} />
                </Pressable>
              </View>
            </View>
            {pending.length > 0 ? (
              <Pressable style={styles.pendingBanner} onPress={() => router.push('/pending')}>
                <IconSymbol name="scissors" size={18} color={Palette.accent} />
                <View style={{ flex: 1 }}>
                  <Txt variant="label" color={Palette.text}>
                    {pending.length} cut{pending.length > 1 ? 's' : ''} from your stylist
                  </Txt>
                  <Txt variant="caption">Tap to review and add to your history.</Txt>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
              </Pressable>
            ) : null}
            <StatsPanel stats={stats} />
            <TimeFilter value={range} onChange={setRange} />
          </View>
        }
        renderItem={({ item }) => (
          <HaircutCard haircut={item} onPress={() => router.push(`/haircut/${item.id}`)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={Palette.accent} />
            ) : (
              <Txt variant="label">
                {range === 'All' ? 'No haircuts yet. Tap + to add one.' : 'No haircuts in this period.'}
              </Txt>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
});
