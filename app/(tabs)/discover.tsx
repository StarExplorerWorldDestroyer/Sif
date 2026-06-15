import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import {
  HAIRCUT_STYLES,
  HAIR_TYPES,
  LENGTHS,
  MAINTENANCE_LEVELS,
  type CutLength,
  type HairType,
  type HaircutStyle,
  type Maintenance,
} from '@/data/discover';
import { useCenteredContent } from '@/hooks/use-responsive';

const LENGTH_COLORS: Record<CutLength, string> = {
  Buzzed: '#FF5733',
  Short: '#3DDC84',
  Medium: '#4DA3FF',
  Shoulder: '#C77DFF',
  Long: '#FFB020',
};

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function DiscoverScreen() {
  const router = useRouter();
  const centered = useCenteredContent(720);

  const [length, setLength] = useState<CutLength | null>(null);
  const [hairType, setHairType] = useState<HairType | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);

  const results = useMemo(
    () =>
      HAIRCUT_STYLES.filter((s) => {
        if (length && s.length !== length) return false;
        if (hairType && !s.hairTypes.includes(hairType)) return false;
        if (maintenance && s.maintenance !== maintenance) return false;
        return true;
      }),
    [length, hairType, maintenance],
  );

  const header = (
    <View>
      <Txt variant="title">Discover</Txt>
      <Txt variant="label" style={styles.subtitle}>
        Find styles that fit your hair and your routine.
      </Txt>

      <FilterRow label="Length" options={LENGTHS} value={length} onChange={setLength} />
      <FilterRow label="Hair type" options={HAIR_TYPES} value={hairType} onChange={setHairType} />
      <FilterRow
        label="Maintenance"
        options={MAINTENANCE_LEVELS}
        value={maintenance}
        onChange={setMaintenance}
      />

      <Txt variant="caption" style={styles.count}>
        {results.length} {results.length === 1 ? 'style' : 'styles'}
      </Txt>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, centered]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <StyleRow style={item} onPress={() => router.push(`/discover/${item.id}`)} />
        )}
        ListEmptyComponent={
          <Txt variant="label" style={styles.empty}>
            No styles match those filters yet. Try clearing one.
          </Txt>
        }
      />
    </SafeAreaView>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <Txt variant="caption" style={styles.filterLabel}>
        {label}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" active={value === null} onPress={() => onChange(null)} />
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            active={value === opt}
            onPress={() => onChange(value === opt ? null : opt)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Txt variant="caption" color={active ? Palette.black : Palette.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

function StyleRow({ style, onPress }: { style: HaircutStyle; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.symbol, { backgroundColor: LENGTH_COLORS[style.length] }]}>
        <Txt variant="body" color={Palette.black} style={styles.symbolText}>
          {initials(style.name)}
        </Txt>
      </View>
      <View style={styles.rowBody}>
        <Txt variant="heading" numberOfLines={1}>
          {style.name}
        </Txt>
        <Txt variant="label" color={Palette.textMuted} numberOfLines={1}>
          {style.length} · {style.hairTypes.join('/')} · {style.maintenance} upkeep
        </Txt>
      </View>
      <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl },
  subtitle: { marginTop: 2, marginBottom: Spacing.lg },
  filterRow: { marginBottom: Spacing.md },
  filterLabel: { marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { gap: Spacing.xs, paddingRight: Spacing.lg },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  chipActive: { backgroundColor: Palette.accent },
  count: { marginTop: Spacing.sm, marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    gap: Spacing.md,
  },
  symbol: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: { fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  empty: { paddingVertical: Spacing.xxl, textAlign: 'center', color: Palette.textMuted },
});
