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
import { useCenteredContent } from '@/hooks/use-responsive';
import { computeStats, filterByRange, type TimeRange } from '@/lib/format';

export default function CutsScreen() {
  const router = useRouter();
  const { haircuts, loading } = useHaircuts();
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
              <Pressable
                style={styles.addButton}
                hitSlop={8}
                onPress={() => router.push('/add')}>
                <IconSymbol name="plus" size={22} color={Palette.black} />
              </Pressable>
            </View>
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
});
