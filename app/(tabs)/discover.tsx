import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRating } from '@/components/ui/stars';
import { TabHeader } from '@/components/ui/tab-header';
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
import { fetchStylists } from '@/lib/bookings';
import { useCenteredContent } from '@/hooks/use-responsive';
import type { StylistCard } from '@/types';

type Mode = 'styles' | 'stylists';

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
  const centered = useCenteredContent();

  const [mode, setMode] = useState<Mode>('styles');
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
      <TabHeader title="Discover" />
      <View style={[styles.toggleWrap, centered]}>
        <View style={styles.toggle}>
          <ModeTab label="Styles" active={mode === 'styles'} onPress={() => setMode('styles')} />
          <ModeTab label="Stylists" active={mode === 'stylists'} onPress={() => setMode('stylists')} />
        </View>
      </View>

      {mode === 'styles' ? (
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
            <EmptyState
              icon="line.3.horizontal.decrease"
              title="No matches"
              subtitle="No styles fit those filters yet. Try clearing one."
              primaryLabel="Clear filters"
              onPrimary={() => {
                setLength(null);
                setHairType(null);
                setMaintenance(null);
              }}
            />
          }
        />
      ) : (
        <StylistDirectory centered={centered} onOpen={(u) => router.push(`/u/${u}`)} />
      )}
    </SafeAreaView>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeTab, active && styles.modeTabActive]} onPress={onPress}>
      <Txt variant="label" color={active ? Palette.black : Palette.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

function StylistDirectory({
  centered,
  onOpen,
}: {
  centered: object | null;
  onOpen: (username: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [stylists, setStylists] = useState<StylistCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const rows = await fetchStylists(query);
      if (active) {
        setStylists(rows);
        setLoading(false);
      }
    }, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, centered]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.searchBox}>
        <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search stylists"
          placeholderTextColor={Palette.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : stylists.length === 0 ? (
        <EmptyState
          icon="scissors"
          title="No stylists yet"
          subtitle={
            query
              ? `No stylists match “${query.trim()}”.`
              : 'Stylists who join Sif will show up here, ready to book.'
          }
        />
      ) : (
        stylists.map((s) => (
          <Pressable
            key={s.id}
            style={styles.stylistRow}
            onPress={() => (s.username ? onOpen(s.username) : undefined)}>
            {s.avatarUrl ? (
              <Image source={{ uri: s.avatarUrl }} style={styles.stylistAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.stylistAvatar, styles.avatarPlaceholder]}>
                <IconSymbol name="scissors" size={18} color={Palette.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Txt variant="body" numberOfLines={1}>
                {s.displayName || s.username || 'Stylist'}
              </Txt>
              {s.ratingCount > 0 ? (
                <View style={styles.ratingRow}>
                  <StarRating value={s.ratingAvg} size={12} />
                  <Txt variant="caption" color={Palette.textMuted}>
                    {s.ratingAvg.toFixed(1)} · {s.ratingCount}
                  </Txt>
                </View>
              ) : null}
              {s.bio ? (
                <Txt variant="caption" color={Palette.textMuted} numberOfLines={1}>
                  {s.bio}
                </Txt>
              ) : s.username ? (
                <Txt variant="caption" color={Palette.textMuted}>
                  @{s.username}
                </Txt>
              ) : null}
            </View>
            <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
          </Pressable>
        ))
      )}
    </ScrollView>
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
  toggleWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  modeTabActive: { backgroundColor: Palette.accent },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 2 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  stylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  stylistAvatar: { width: 48, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginVertical: 1 },
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
});
