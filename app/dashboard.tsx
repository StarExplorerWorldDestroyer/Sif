import { AppImage as Image } from '@/components/ui/app-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRating } from '@/components/ui/stars';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent, useIsDesktop } from '@/hooks/use-responsive';
import { updateBookingStatus } from '@/lib/bookings';
import { earningsCsv, exportCsv } from '@/lib/export';
import {
  cutsInRange,
  DATE_RANGES,
  fetchStylistDashboard,
  HEAT_BUCKETS,
  rangeStats,
  type DateRange,
  type StylistDashboard,
} from '@/lib/stylist-stats';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';
import type { Booking } from '@/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function clientLabel(b: Booking): string {
  return b.other.displayName || (b.other.username ? `@${b.other.username}` : 'Sif user');
}

export default function DashboardScreen() {
  const router = useRouter();
  const money = useMoney();
  const isDesktop = useIsDesktop();
  const centered = useCenteredContent(isDesktop ? 980 : 680);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [data, setData] = useState<StylistDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('month');

  const load = useCallback(async () => {
    if (!user) return;
    const d = await fetchStylistDashboard(user.id);
    setData(d);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respond = useCallback(
    async (id: string, status: 'confirmed' | 'declined') => {
      setData((prev) => (prev ? { ...prev, pending: prev.pending.filter((b) => b.id !== id) } : prev));
      await updateBookingStatus(id, status);
      load();
    },
    [load],
  );

  const stats = useMemo(() => (data ? rangeStats(data.cuts, range) : null), [data, range]);

  const exportEarnings = useCallback(() => {
    if (!data) return;
    const rows = cutsInRange(data.cuts, range);
    if (rows.length === 0) return;
    exportCsv(`sif-earnings-${range}.csv`, earningsCsv(rows));
  }, [data, range]);

  const isStylist = profile?.isStylist ?? false;
  const maxRev = data ? Math.max(1, ...data.monthly.map((m) => m.revenue)) : 1;
  const maxService = stats ? Math.max(1, ...stats.byService.map((s) => s.revenue)) : 1;
  const maxRetention = data
    ? Math.max(1, ...data.retention.monthly.map((m) => m.newClients + m.returning))
    : 1;
  const half: ViewStyle | undefined = isDesktop ? styles.half : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Dashboard</Txt>
        <Pressable onPress={() => router.push('/availability')} hitSlop={8}>
          <IconSymbol name="gearshape" size={22} color={Palette.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : !isStylist ? (
        <EmptyState
          icon="scissors"
          title="Turn on your stylist account"
          subtitle="Enable a stylist account in Settings to take bookings and unlock your dashboard."
          primaryLabel="Open settings"
          onPrimary={() => router.push('/settings')}
        />
      ) : data && stats ? (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}>
          {/* Hero metrics (all-time) */}
          <View style={styles.grid}>
            <StatBox
              label="Rating"
              value={data.ratingCount > 0 ? data.ratingAvg.toFixed(1) : '—'}
              sub={data.ratingCount > 0 ? `${data.ratingCount} reviews` : 'No reviews yet'}
              accent>
              {data.ratingCount > 0 ? <StarRating value={data.ratingAvg} size={12} /> : null}
            </StatBox>
            <StatBox label="Upcoming" value={`${data.upcoming.length}`} sub="confirmed" />
            <StatBox label="Cuts" value={`${data.cutsAllTime}`} sub="all time" />
            <StatBox label="Earned" value={money(data.earnedAllTime)} sub="all time" />
          </View>

          {/* Range selector */}
          <View style={styles.rangeRow}>
            {DATE_RANGES.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.rangeChip, range === r.value && styles.rangeChipActive]}
                onPress={() => setRange(r.value)}>
                <Txt variant="caption" color={range === r.value ? Palette.black : Palette.textMuted}>
                  {r.label}
                </Txt>
              </Pressable>
            ))}
          </View>

          <View style={isDesktop ? styles.flow : undefined}>
            {/* Requests */}
            {data.pending.length > 0 ? (
              <Section title="Requests" onAll={() => router.push('/bookings')} style={half}>
                {data.pending.slice(0, 4).map((b) => (
                  <View key={b.id} style={styles.row}>
                    <ClientFace booking={b} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="body" numberOfLines={1}>
                        {clientLabel(b)}
                      </Txt>
                      <Txt variant="caption" color={Palette.textMuted}>
                        {formatWhen(b.startsAt)}
                      </Txt>
                    </View>
                    <Pressable
                      style={[styles.miniBtn, styles.miniPrimary]}
                      onPress={() => respond(b.id, 'confirmed')}>
                      <Txt variant="caption" color={Palette.black} style={{ fontWeight: '700' }}>
                        Confirm
                      </Txt>
                    </Pressable>
                    <Pressable style={styles.miniBtn} onPress={() => respond(b.id, 'declined')}>
                      <Txt variant="caption" color={Palette.text}>
                        Decline
                      </Txt>
                    </Pressable>
                  </View>
                ))}
              </Section>
            ) : null}

            {/* Next up */}
            {data.upcoming.length > 0 ? (
              <Section title="Next up" onAll={() => router.push('/bookings')} style={half}>
                {data.upcoming.slice(0, 4).map((b) => (
                  <Pressable key={b.id} style={styles.row} onPress={() => router.push('/bookings')}>
                    <ClientFace booking={b} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="body" numberOfLines={1}>
                        {clientLabel(b)}
                      </Txt>
                      <Txt variant="caption" color={Palette.textMuted}>
                        {formatWhen(b.startsAt)}
                      </Txt>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
                  </Pressable>
                ))}
              </Section>
            ) : null}

            {/* Earnings (range) */}
            <Section
              title={`Earnings · ${rangeLabel(range)}`}
              style={half}
              actionLabel="Export CSV"
              onAll={stats.count > 0 ? exportEarnings : undefined}>
              <View style={styles.earnTop}>
                <View>
                  <Txt variant="caption" color={Palette.textMuted}>
                    Earned
                  </Txt>
                  <Txt variant="title" color={Palette.accent}>
                    {money(stats.earned)}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="caption" color={Palette.textMuted}>
                    Avg / cut
                  </Txt>
                  <Txt variant="heading">{money(stats.avg)}</Txt>
                </View>
              </View>
              <View style={styles.miniStatsRow}>
                <MiniStat label="Service" value={money(stats.service)} />
                <MiniStat label="Tips" value={money(stats.tips)} />
                <MiniStat label="Cuts" value={`${stats.count}`} />
              </View>
              <View style={styles.chart}>
                {data.monthly.map((m) => (
                  <View key={m.key} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: `${Math.max(m.revenue > 0 ? 6 : 0, (m.revenue / maxRev) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Txt variant="caption" color={Palette.textDim}>
                      {m.label}
                    </Txt>
                  </View>
                ))}
              </View>
              <Txt variant="caption" color={Palette.textDim} style={{ textAlign: 'center' }}>
                Revenue · last 6 months
              </Txt>
            </Section>

            {/* By service (range) */}
            <Section title={`By service · ${rangeLabel(range)}`} style={half}>
              {stats.byService.length === 0 ? (
                <Txt variant="caption" color={Palette.textMuted}>
                  No cuts in this period yet.
                </Txt>
              ) : (
                stats.byService.slice(0, 6).map((s) => (
                  <View key={s.cutType} style={styles.serviceRow}>
                    <View style={styles.serviceHead}>
                      <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>
                        {s.cutType}
                      </Txt>
                      <Txt variant="caption" color={Palette.textMuted}>
                        {money(s.revenue)} · {s.count}
                      </Txt>
                    </View>
                    <View style={styles.serviceTrack}>
                      <View style={[styles.serviceFill, { width: `${(s.revenue / maxService) * 100}%` }]} />
                    </View>
                  </View>
                ))
              )}
            </Section>

            {/* Performance (all-time) */}
            <Section title="Performance" style={half}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.ratingDist[star - 1];
                const frac = data.ratingCount > 0 ? count / data.ratingCount : 0;
                return (
                  <View key={star} style={styles.distRow}>
                    <Txt variant="caption" color={Palette.textMuted} style={styles.distStar}>
                      {star}★
                    </Txt>
                    <View style={styles.distTrack}>
                      <View style={[styles.distFill, { width: `${frac * 100}%` }]} />
                    </View>
                    <Txt variant="caption" color={Palette.textDim} style={styles.distCount}>
                      {count}
                    </Txt>
                  </View>
                );
              })}
              <View style={styles.metaDivider} />
              <Meter label="Response rate" value={pct(data.responseRate)} />
              <Meter label="Completion rate" value={pct(data.completionRate)} />
              <Meter label="Reviews replied" value={pct(data.replyRate)} />
            </Section>

            {/* Busiest times */}
            <Section title="Busiest times" style={half}>
              {data.heatmap.total === 0 ? (
                <Txt variant="caption" color={Palette.textMuted}>
                  No confirmed appointments yet.
                </Txt>
              ) : (
                <>
                  <View style={styles.heatRow}>
                    <View style={styles.heatDayLabel} />
                    {HEAT_BUCKETS.map((b) => (
                      <Txt
                        key={b.label}
                        variant="caption"
                        color={Palette.textDim}
                        style={styles.heatColLabel}>
                        {b.label}
                      </Txt>
                    ))}
                  </View>
                  {DAY_NAMES.map((dayName, day) => (
                    <View key={dayName} style={styles.heatRow}>
                      <Txt variant="caption" color={Palette.textMuted} style={styles.heatDayLabel}>
                        {dayName.slice(0, 1)}
                      </Txt>
                      {data.heatmap.grid[day].map((count, bucket) => {
                        const intensity = data.heatmap.max > 0 ? count / data.heatmap.max : 0;
                        return (
                          <View key={bucket} style={styles.heatCellWrap}>
                            <View
                              style={[
                                styles.heatCell,
                                count > 0
                                  ? { backgroundColor: Palette.accent, opacity: 0.25 + 0.75 * intensity }
                                  : styles.heatCellEmpty,
                              ]}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ))}
                  {data.heatmap.busiest ? (
                    <Txt variant="caption" color={Palette.textDim} style={styles.heatHint}>
                      Busiest around {DAY_NAMES[data.heatmap.busiest.day]} ·{' '}
                      {HEAT_BUCKETS[data.heatmap.busiest.bucket].label}
                    </Txt>
                  ) : null}
                </>
              )}
            </Section>

            {/* Clients (all-time) */}
            <Section title="Clients" style={half}>
              <View style={styles.grid}>
                <StatBox label="Total" value={`${data.uniqueClients}`} sub="clients served" />
                <StatBox label="Repeat" value={`${data.repeatClients}`} sub="2+ visits" />
              </View>
              {data.topClient && data.topClient.count > 1 ? (
                <Meter label="Top client" value={`${data.topClient.name} · ${data.topClient.count}`} />
              ) : null}
            </Section>

            {/* Retention */}
            <Section title="Retention" style={half}>
              <View style={styles.legendRow}>
                <Legend color={Palette.success} label="Returning" />
                <Legend color={Palette.accent} label="New" />
              </View>
              <View style={styles.chart}>
                {data.retention.monthly.map((m) => {
                  const total = m.newClients + m.returning;
                  const retFrac = total > 0 ? m.returning / total : 0;
                  return (
                    <View key={m.key} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.retStack,
                            { height: `${Math.max(total > 0 ? 6 : 0, (total / maxRetention) * 100)}%` },
                          ]}>
                          <View style={{ flex: 1 - retFrac, backgroundColor: Palette.accent }} />
                          <View style={{ flex: retFrac, backgroundColor: Palette.success }} />
                        </View>
                      </View>
                      <Txt variant="caption" color={Palette.textDim}>
                        {m.label}
                      </Txt>
                    </View>
                  );
                })}
              </View>
              <View style={styles.metaDivider} />
              <Meter label="Repeat rate" value={pct(data.retention.repeatRate)} />
            </Section>

            {/* Recent reviews */}
            {data.recentReviews.length > 0 ? (
              <Section
                title="Recent reviews"
                style={half}
                onAll={profile?.username ? () => router.push(`/u/${profile.username}`) : undefined}>
                {data.recentReviews.map((r) => (
                  <View key={r.id} style={styles.reviewRow}>
                    <View style={styles.reviewHead}>
                      <StarRating value={r.rating} size={12} />
                      <Txt variant="caption" color={Palette.textMuted}>
                        {r.author.displayName || (r.author.username ? `@${r.author.username}` : 'Client')}
                      </Txt>
                    </View>
                    {r.body ? (
                      <Txt variant="label" color={Palette.text} numberOfLines={2}>
                        {r.body}
                      </Txt>
                    ) : null}
                    {!r.reply ? (
                      <Txt variant="caption" color={Palette.accent}>
                        Needs a reply
                      </Txt>
                    ) : null}
                  </View>
                ))}
              </Section>
            ) : null}

            {/* Manage */}
            <Section title="Manage" style={half}>
              <ActionRow icon="calendar" label="Availability & hours" onPress={() => router.push('/availability')} />
              <ActionRow icon="person.2.fill" label="All bookings" onPress={() => router.push('/bookings')} />
              <ActionRow icon="scissors" label="Create a cut for a client" onPress={() => router.push('/add')} />
              <ActionRow icon="pencil" label="Edit profile" onPress={() => router.push('/profile/edit')} />
              {profile?.username ? (
                <ActionRow
                  icon="person.fill"
                  label="View public profile"
                  onPress={() => router.push(`/u/${profile.username}`)}
                />
              ) : null}
            </Section>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function rangeLabel(range: DateRange): string {
  return DATE_RANGES.find((r) => r.value === range)?.label ?? '';
}

function ClientFace({ booking }: { booking: Booking }) {
  const uri = booking.other.avatarUrl;
  if (uri) return <Image source={{ uri }} style={styles.face} contentFit="cover" />;
  return (
    <View style={[styles.face, styles.facePlaceholder]}>
      <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
    </View>
  );
}

function Section({
  title,
  onAll,
  actionLabel = 'View all',
  style,
  children,
}: {
  title: string;
  onAll?: () => void;
  actionLabel?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
          {title.toUpperCase()}
        </Txt>
        {onAll ? (
          <Pressable onPress={onAll} hitSlop={8}>
            <Txt variant="caption" color={Palette.accent}>
              {actionLabel}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function StatBox({
  label,
  value,
  sub,
  accent,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.statBox}>
      <Txt variant="caption" color={Palette.textMuted}>
        {label}
      </Txt>
      <Txt variant="title" color={accent ? Palette.accent : Palette.text}>
        {value}
      </Txt>
      {children}
      {sub ? (
        <Txt variant="caption" color={Palette.textDim}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Txt variant="caption" color={Palette.textMuted}>
        {label}
      </Txt>
      <Txt variant="body" color={Palette.text}>
        {value}
      </Txt>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Txt variant="caption" color={Palette.textMuted}>
        {label}
      </Txt>
    </View>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meterRow}>
      <Txt variant="label" color={Palette.textMuted}>
        {label}
      </Txt>
      <Txt variant="body" color={Palette.text}>
        {value}
      </Txt>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <IconSymbol name={icon} size={18} color={Palette.textMuted} />
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
    </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statBox: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 130,
    gap: 2,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.md,
  },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.lg },
  rangeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  rangeChipActive: { backgroundColor: Palette.accent },
  flow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, alignItems: 'flex-start' },
  half: { width: '48%' },
  section: { marginTop: Spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { letterSpacing: 1 },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  face: { width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  facePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  miniBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceAlt,
  },
  miniPrimary: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  earnTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  miniStatsRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
  miniStat: { gap: 1 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  barCol: { flex: 1, alignItems: 'center', gap: Spacing.xs, height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: {
    width: '70%',
    minHeight: 2,
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
    backgroundColor: Palette.accent,
  },
  serviceRow: { paddingVertical: Spacing.xs, gap: Spacing.xs },
  serviceHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  serviceTrack: { height: 8, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt, overflow: 'hidden' },
  serviceFill: { height: '100%', backgroundColor: Palette.accent, borderRadius: Radius.pill },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  distStar: { width: 24 },
  distTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    overflow: 'hidden',
  },
  distFill: { height: '100%', backgroundColor: Palette.accent, borderRadius: Radius.pill },
  distCount: { width: 24, textAlign: 'right' },
  metaDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border, marginVertical: Spacing.md },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  reviewRow: { paddingVertical: Spacing.sm, gap: 3 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  heatDayLabel: { width: 16, textAlign: 'center' },
  heatColLabel: { flex: 1, textAlign: 'center' },
  heatCellWrap: { flex: 1, aspectRatio: 1.6 },
  heatCell: { flex: 1, borderRadius: Radius.sm },
  heatCellEmpty: { backgroundColor: Palette.surfaceAlt, opacity: 0.5 },
  heatHint: { marginTop: Spacing.sm, textAlign: 'center' },
  legendRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  retStack: {
    width: '70%',
    overflow: 'hidden',
    borderRadius: Radius.sm,
    flexDirection: 'column',
  },
});
