import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Spacing } from '@/constants/theme';
import { type Stats } from '@/lib/format';
import { useMoney } from '@/hooks/use-money';

function StatTile({
  label,
  value,
  accent,
  trailing,
}: {
  label: string;
  value: string;
  accent?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.tile}>
      <Txt variant="caption">{label}</Txt>
      <View style={styles.valueRow}>
        <Txt variant="heading" color={accent ? Palette.accent : Palette.text}>
          {value}
        </Txt>
        {trailing}
      </View>
    </View>
  );
}

export function StatsPanel({ stats }: { stats: Stats }) {
  const money = useMoney();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <StatTile
          label="Total Spent"
          value={money(stats.totalSpent)}
          trailing={<IconSymbol name="arrow.up.right" size={14} color={Palette.success} />}
        />
        <View style={styles.divider} />
        <StatTile label="Average" value={money(stats.average)} />
        <View style={styles.divider} />
        <StatTile
          label={`Tips (${Math.round(stats.tipPercent)}%)`}
          value={money(stats.totalTips)}
          accent
        />
      </View>

      {stats.mostVisited ? (
        <View style={styles.mostVisited}>
          <Txt variant="caption">Most Visited</Txt>
          <Txt variant="body">{stats.mostVisited}</Txt>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tile: {
    flex: 1,
    gap: Spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Palette.border,
    marginHorizontal: Spacing.sm,
  },
  mostVisited: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
    gap: Spacing.xs,
  },
});
