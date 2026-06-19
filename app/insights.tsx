import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent } from '@/hooks/use-responsive';
import { formatDate } from '@/lib/format';
import { computeInsights, describeCadence, type CadenceStatus } from '@/lib/insights';
import { useHaircuts } from '@/store/haircuts';

const STATUS_LABEL: Record<CadenceStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  on_track: 'On track',
  insufficient: '',
};

export default function InsightsScreen() {
  const router = useRouter();
  const money = useMoney();
  const centered = useCenteredContent(640);
  const { haircuts } = useHaircuts();
  const insights = useMemo(() => computeInsights(haircuts), [haircuts]);

  const maxMonth = Math.max(1, ...insights.monthly.map((m) => m.total));
  const hasCadence = insights.cadence.status !== 'insufficient';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Insights" />

      {haircuts.length === 0 ? (
        <EmptyState
          icon="chart.bar"
          title="No insights yet"
          subtitle="Log a few cuts and we'll surface your spend trends and how often you visit."
          primaryLabel="Add a cut"
          onPrimary={() => router.push('/add')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}>
          {hasCadence ? (
            <Card style={styles.section}>
              <View style={styles.cadenceTop}>
                <View style={{ flex: 1 }}>
                  <Txt variant="caption">Your rhythm</Txt>
                  <Txt variant="title" color={Palette.text}>
                    {describeCadence(insights.cadence.cadenceDays).replace(/^every /, '')}
                  </Txt>
                </View>
                <View style={[styles.chip, chipStyle(insights.cadence.status)]}>
                  <Txt variant="caption" color={chipText(insights.cadence.status)}>
                    {STATUS_LABEL[insights.cadence.status]}
                  </Txt>
                </View>
              </View>
              {insights.cadence.predictedNext ? (
                <View style={styles.cadenceRow}>
                  <IconSymbol name="calendar" size={16} color={Palette.textMuted} />
                  <Txt variant="label" color={Palette.textMuted}>
                    {insights.cadence.status === 'overdue'
                      ? `Was due ${formatDate(insights.cadence.predictedNext)}`
                      : `Next cut around ${formatDate(insights.cadence.predictedNext)}`}
                  </Txt>
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card style={styles.section}>
            <Txt variant="caption">Spend · last 6 months</Txt>
            <View style={styles.chart}>
              {insights.monthly.map((m) => (
                <View key={m.key} style={styles.barCol}>
                  <Txt variant="caption" color={Palette.textMuted} style={styles.barValue}>
                    {m.total > 0 ? money(m.total) : ''}
                  </Txt>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${Math.max(m.total > 0 ? 6 : 0, (m.total / maxMonth) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Txt variant="caption" color={Palette.textDim}>
                    {m.label}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.grid}>
            <StatBox label="Total spent" value={money(insights.totalSpent)} />
            <StatBox label="Avg / cut" value={money(insights.avgPerCut)} />
            <StatBox label="Avg / month" value={money(insights.avgPerMonth)} />
            <StatBox
              label="Projected / year"
              value={money(insights.projectedAnnual)}
              accent
            />
            <StatBox label="Tips" value={`${Math.round(insights.tipPercent)}%`} />
            <StatBox label="Cuts logged" value={`${haircuts.length}`} />
          </View>

          {insights.mostVisited || insights.topStylist ? (
            <Card style={styles.section}>
              {insights.mostVisited ? (
                <Row label="Most visited" value={insights.mostVisited} />
              ) : null}
              {insights.topStylist ? (
                <Row label="Top stylist" value={insights.topStylist} />
              ) : null}
              {insights.cutsPerYear > 0 ? (
                <Row label="Cuts per year" value={`~${Math.round(insights.cutsPerYear)}`} />
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card style={styles.box}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="heading" color={accent ? Palette.accent : Palette.text}>
        {value}
      </Txt>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Txt variant="label" color={Palette.textMuted}>
        {label}
      </Txt>
      <Txt variant="body" color={Palette.text}>
        {value}
      </Txt>
    </View>
  );
}

function chipStyle(status: CadenceStatus) {
  if (status === 'overdue' || status === 'due_soon') return { backgroundColor: Palette.accentSoft };
  return { backgroundColor: Palette.surfaceAlt };
}
function chipText(status: CadenceStatus) {
  if (status === 'overdue' || status === 'due_soon') return Palette.accent;
  return Palette.textMuted;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  section: { gap: Spacing.md },
  cadenceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  cadenceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
    gap: Spacing.sm,
  },
  barCol: { flex: 1, alignItems: 'center', gap: Spacing.xs, height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 10 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: {
    width: '70%',
    minHeight: 2,
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
    backgroundColor: Palette.accent,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  box: { flexGrow: 1, flexBasis: '30%', minWidth: 100, gap: Spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
});
