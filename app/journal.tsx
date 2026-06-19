import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useRefresh } from '@/hooks/use-refresh';
import { formatDate } from '@/lib/format';
import {
  buildJournal,
  describeDaysAfter,
  journalSummary,
  type JournalCut,
  type JournalEntry,
  type JournalGrowout,
} from '@/lib/journal';
import { useHaircuts } from '@/store/haircuts';
import type { HaircutUpdate } from '@/types';

export default function JournalScreen() {
  const router = useRouter();
  const money = useMoney();
  const centered = useCenteredContent(640);
  const { haircuts, loading, refetch, fetchAllUpdates } = useHaircuts();
  const [updates, setUpdates] = useState<HaircutUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  const reload = useCallback(async () => {
    setLoadingUpdates(true);
    setUpdates(await fetchAllUpdates());
    setLoadingUpdates(false);
  }, [fetchAllUpdates]);

  useEffect(() => {
    reload();
  }, [reload]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refetch(), reload()]);
  }, [refetch, reload]);
  const { refreshing, onRefresh } = useRefresh(refreshAll);

  const sections = useMemo(() => buildJournal(haircuts, updates), [haircuts, updates]);
  const summary = useMemo(() => journalSummary(haircuts, updates), [haircuts, updates]);
  const busy = loading || loadingUpdates;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Journal" />

      {haircuts.length === 0 ? (
        busy ? (
          <View style={styles.center}>
            <ActivityIndicator color={Palette.accent} />
          </View>
        ) : (
          <EmptyState
            icon="book"
            title="Your hair story starts here"
            subtitle="Log cuts and add grow-out photos — they'll weave into a timeline you can look back on."
            primaryLabel="Add a cut"
            onPrimary={() => router.push('/add')}
          />
        )
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />
          }>
          <View style={styles.summary}>
            <Stat value={`${summary.cutCount}`} label={summary.cutCount === 1 ? 'cut' : 'cuts'} />
            <View style={styles.summaryDivider} />
            <Stat
              value={`${summary.growoutCount}`}
              label={summary.growoutCount === 1 ? 'grow-out' : 'grow-outs'}
            />
            {summary.span ? (
              <>
                <View style={styles.summaryDivider} />
                <Stat value={summary.span} label="span" wide />
              </>
            ) : null}
          </View>

          {sections.map((section) => (
            <View key={section.year}>
              <View style={styles.yearRow}>
                <View style={styles.rail}>
                  <View style={styles.line} />
                </View>
                <Txt variant="caption" color={Palette.textMuted} style={styles.yearLabel}>
                  {section.year}
                </Txt>
              </View>
              {section.entries.map((entry) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  money={money}
                  onPress={() => router.push(`/haircut/${entry.haircutId}`)}
                />
              ))}
            </View>
          ))}

          <View style={styles.endRow}>
            <View style={styles.rail}>
              <View style={[styles.line, styles.lineTopOnly]} />
              <View style={styles.endDot} />
            </View>
            <Txt variant="caption" color={Palette.textDim} style={styles.yearLabel}>
              The beginning
            </Txt>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({
  entry,
  money,
  onPress,
}: {
  entry: JournalEntry;
  money: (n: number) => string;
  onPress: () => void;
}) {
  const isCut = entry.kind === 'cut';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rail}>
        <View style={styles.line} />
        <View style={[styles.dot, isCut ? styles.dotCut : styles.dotGrow]} />
      </View>
      <View style={[styles.body, isCut ? styles.bodyCut : styles.bodyGrow]}>
        {entry.photoUri ? (
          <Image source={{ uri: entry.photoUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <IconSymbol name="scissors" size={18} color={Palette.textDim} />
          </View>
        )}
        {isCut ? (
          <CutBody entry={entry as JournalCut} money={money} />
        ) : (
          <GrowoutBody entry={entry as JournalGrowout} />
        )}
      </View>
    </Pressable>
  );
}

function CutBody({ entry, money }: { entry: JournalCut; money: (n: number) => string }) {
  const total = entry.price + entry.tip;
  const sub = [entry.location, entry.stylistName].filter(Boolean).join(' · ');
  return (
    <View style={styles.bodyText}>
      <View style={styles.titleRow}>
        <Txt variant="body" color={Palette.text} numberOfLines={1} style={{ flexShrink: 1 }}>
          {entry.cutType}
        </Txt>
        {entry.milestone ? (
          <View style={styles.milestone}>
            <IconSymbol name="sparkles" size={11} color={Palette.accent} />
            <Txt variant="caption" color={Palette.accent}>
              {entry.milestone}
            </Txt>
          </View>
        ) : null}
      </View>
      {sub ? (
        <Txt variant="label" color={Palette.textMuted} numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
      <View style={styles.metaRow}>
        <Txt variant="caption" color={Palette.textDim}>
          {formatDate(entry.date)}
        </Txt>
        {total > 0 ? (
          <Txt variant="caption" color={Palette.textMuted}>
            {money(total)}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

function GrowoutBody({ entry }: { entry: JournalGrowout }) {
  return (
    <View style={styles.bodyText}>
      <View style={styles.titleRow}>
        <IconSymbol name="camera.fill" size={13} color={Palette.textMuted} />
        <Txt variant="label" color={Palette.text} numberOfLines={1} style={{ flexShrink: 1 }}>
          Grow-out
          {entry.daysAfterCut !== null ? ` · ${describeDaysAfter(entry.daysAfterCut)}` : ''}
        </Txt>
      </View>
      {entry.note ? (
        <Txt variant="label" color={Palette.textMuted} numberOfLines={2}>
          {entry.note}
        </Txt>
      ) : null}
      <Txt variant="caption" color={Palette.textDim}>
        {formatDate(entry.date)}
      </Txt>
    </View>
  );
}

function Stat({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && { flex: 1.6 }]}>
      <Txt variant="heading" color={Palette.text} numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="caption" color={Palette.textMuted}>
        {label}
      </Txt>
    </View>
  );
}

const RAIL = 28;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  stat: { flex: 1, gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: Palette.border },
  yearRow: { flexDirection: 'row', alignItems: 'center', height: 36 },
  yearLabel: { letterSpacing: 1, textTransform: 'uppercase', marginLeft: Spacing.md },
  rail: { width: RAIL, alignSelf: 'stretch', alignItems: 'center' },
  line: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: Palette.border },
  lineTopOnly: { bottom: undefined, height: 18 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
    zIndex: 1,
  },
  dotCut: { backgroundColor: Palette.accent },
  dotGrow: {
    backgroundColor: Palette.black,
    borderWidth: 2,
    borderColor: Palette.textDim,
  },
  endDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.border,
    marginTop: 14,
  },
  endRow: { flexDirection: 'row', alignItems: 'flex-start', height: 36 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  bodyCut: {
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  bodyGrow: { backgroundColor: Palette.surfaceAlt },
  thumb: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Palette.surfaceAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  bodyText: { flex: 1, justifyContent: 'center', gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accentSoft,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
