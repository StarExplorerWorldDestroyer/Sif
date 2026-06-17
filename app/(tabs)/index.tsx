import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { HaircutCard } from '@/components/cuts/haircut-card';
import { StatsPanel } from '@/components/cuts/stats-panel';
import { TimeFilter } from '@/components/cuts/time-filter';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/screen';
import { TabHeader } from '@/components/ui/tab-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useHaircuts } from '@/store/haircuts';
import { useCenteredContent } from '@/hooks/use-responsive';
import { computeStats, filterByRange, type TimeRange } from '@/lib/format';

export default function CutsScreen() {
  const router = useRouter();
  const { haircuts, pending, loading } = useHaircuts();
  const [range, setRange] = useState<TimeRange>('All');
  const centered = useCenteredContent();

  const filtered = useMemo(() => filterByRange(haircuts, range), [haircuts, range]);
  const stats = useMemo(() => computeStats(filtered), [filtered]);

  return (
    <Screen padded={false}>
      <TabHeader
        title="Sif"
        titleHref="/"
        actions={
          <Pressable style={styles.addButton} hitSlop={8} onPress={() => router.push('/add')}>
            <IconSymbol name="plus" size={22} color={Palette.black} />
          </Pressable>
        }
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, centered]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
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
