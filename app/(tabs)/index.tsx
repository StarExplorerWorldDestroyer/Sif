import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { CutReminder } from '@/components/cuts/cut-reminder';
import { HaircutCard } from '@/components/cuts/haircut-card';
import { ProfileCompleteness } from '@/components/cuts/profile-completeness';
import { StatsPanel } from '@/components/cuts/stats-panel';
import { TimeFilter } from '@/components/cuts/time-filter';
import { EmptyState } from '@/components/ui/empty-state';
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
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              hitSlop={8}
              onPress={() => router.push('/journal')}>
              <IconSymbol name="book" size={20} color={Palette.text} />
            </Pressable>
            <Pressable
              style={styles.iconButton}
              hitSlop={8}
              onPress={() => router.push('/insights')}>
              <IconSymbol name="chart.bar" size={20} color={Palette.text} />
            </Pressable>
            <Pressable style={styles.addButton} hitSlop={8} onPress={() => router.push('/add')}>
              <IconSymbol name="plus" size={22} color={Palette.black} />
            </Pressable>
          </View>
        }
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, centered]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <ProfileCompleteness />
            <CutReminder />
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
            <Pressable onPress={() => router.push('/insights')}>
              <StatsPanel stats={stats} />
            </Pressable>
            <TimeFilter value={range} onChange={setRange} />
          </View>
        }
        renderItem={({ item }) => (
          <HaircutCard haircut={item} onPress={() => router.push(`/haircut/${item.id}`)} />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : range === 'All' ? (
            <EmptyState
              icon="scissors"
              title="Start your hair history"
              subtitle="Add your first cut to track styles, costs, and how it grows out over time."
              primaryLabel="Add a cut"
              onPrimary={() => router.push('/add')}
              secondaryLabel="Browse styles"
              onSecondary={() => router.push('/discover')}
            />
          ) : (
            <EmptyState
              icon="scissors"
              title="No cuts in this period"
              subtitle="Try a different time range, or log a new cut."
              primaryLabel="Add a cut"
              onPrimary={() => router.push('/add')}
            />
          )
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
