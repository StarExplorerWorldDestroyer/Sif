import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent } from '@/hooks/use-responsive';
import { updateBookingPrice, updateBookingStatus } from '@/lib/bookings';
import { fetchStylistDashboard, type StylistDashboard } from '@/lib/stylist-stats';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';
import type { Booking } from '@/types';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const money = useMoney();
  const centered = useCenteredContent(680);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [data, setData] = useState<StylistDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceTarget, setPriceTarget] = useState<Booking | null>(null);
  const [priceText, setPriceText] = useState('');

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
      setData((prev) =>
        prev ? { ...prev, pending: prev.pending.filter((b) => b.id !== id) } : prev,
      );
      await updateBookingStatus(id, status);
      load();
    },
    [load],
  );

  const openPrice = useCallback((b: Booking) => {
    setPriceTarget(b);
    setPriceText(b.price > 0 ? String(b.price) : '');
  }, []);

  const savePrice = useCallback(async () => {
    if (!priceTarget) return;
    const value = Math.max(0, Number(priceText) || 0);
    await updateBookingPrice(priceTarget.id, value);
    setPriceTarget(null);
    setPriceText('');
    load();
  }, [priceTarget, priceText, load]);

  const isStylist = profile?.isStylist ?? false;
  const maxRev = data ? Math.max(1, ...data.monthly.map((m) => m.revenue)) : 1;

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
      ) : data ? (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}>
          {/* Hero metrics */}
          <View style={styles.grid}>
            <StatBox
              label="Rating"
              value={data.ratingCount > 0 ? data.ratingAvg.toFixed(1) : '—'}
              sub={data.ratingCount > 0 ? `${data.ratingCount} reviews` : 'No reviews yet'}
              accent
            >
              {data.ratingCount > 0 ? <StarRating value={data.ratingAvg} size={12} /> : null}
            </StatBox>
            <StatBox label="Upcoming" value={`${data.upcoming.length}`} sub="confirmed" />
            <StatBox label="Completed" value={`${data.completedCount}`} sub="all time" />
            <StatBox
              label="This month"
              value={`${data.apptThisMonth}`}
              sub={trendLabel(data.apptThisMonth, data.apptLastMonth)}
            />
          </View>

          {/* Requests needing action */}
          {data.pending.length > 0 ? (
            <Section title="Requests" onAll={() => router.push('/bookings')}>
              {data.pending.slice(0, 4).map((b) => (
                <View key={b.id} style={styles.requestRow}>
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

          {/* Upcoming schedule */}
          {data.upcoming.length > 0 ? (
            <Section title="Next up" onAll={() => router.push('/bookings')}>
              {data.upcoming.slice(0, 4).map((b) => (
                <Pressable key={b.id} style={styles.scheduleRow} onPress={() => router.push('/bookings')}>
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

          {/* Earnings */}
          <Section title="Earnings">
            <View style={styles.earnTop}>
              <View>
                <Txt variant="caption" color={Palette.textMuted}>
                  Total earned
                </Txt>
                <Txt variant="title" color={Palette.accent}>
                  {money(data.totalRevenue)}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="caption" color={Palette.textMuted}>
                  Avg / appt
                </Txt>
                <Txt variant="heading">{money(data.avgRevenue)}</Txt>
              </View>
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
            {data.unpricedCount > 0 ? (
              <Txt variant="caption" color={Palette.textMuted} style={{ marginTop: Spacing.sm }}>
                {data.unpricedCount} completed{' '}
                {data.unpricedCount === 1 ? 'appointment needs' : 'appointments need'} a price below.
              </Txt>
            ) : null}
          </Section>

          {/* Appointment pricing */}
          {data.completed.length > 0 ? (
            <Section title="Appointments & pricing">
              {data.completed.slice(0, 8).map((b) => (
                <Pressable key={b.id} style={styles.priceRow} onPress={() => openPrice(b)}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" numberOfLines={1}>
                      {clientLabel(b)}
                    </Txt>
                    <Txt variant="caption" color={Palette.textMuted}>
                      {formatWhen(b.startsAt)}
                    </Txt>
                  </View>
                  {b.price > 0 ? (
                    <Txt variant="body" color={Palette.text}>
                      {money(b.price)}
                    </Txt>
                  ) : (
                    <Txt variant="caption" color={Palette.accent}>
                      Set price
                    </Txt>
                  )}
                </Pressable>
              ))}
            </Section>
          ) : null}

          {/* Performance */}
          <Section title="Performance">
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

          {/* Clients */}
          <Section title="Clients">
            <View style={styles.grid}>
              <StatBox label="Total" value={`${data.uniqueClients}`} sub="clients served" />
              <StatBox label="Repeat" value={`${data.repeatClients}`} sub="2+ visits" />
            </View>
            {data.topClient && data.topClient.count > 1 ? (
              <Meter label="Top client" value={`${data.topClient.name} · ${data.topClient.count}`} />
            ) : null}
          </Section>

          {/* Recent reviews */}
          {data.recentReviews.length > 0 ? (
            <Section
              title="Recent reviews"
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

          {/* Quick actions */}
          <Section title="Manage">
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
        </ScrollView>
      ) : null}

      <Modal
        visible={!!priceTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPriceTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Txt variant="heading">What did you charge?</Txt>
            <Txt variant="label" color={Palette.textMuted} style={{ marginTop: Spacing.xs }}>
              {priceTarget ? clientLabel(priceTarget) : ''}
            </Txt>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder="0"
              placeholderTextColor={Palette.textDim}
              keyboardType="decimal-pad"
              style={styles.priceInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setPriceTarget(null)}>
                <Txt variant="label" color={Palette.text}>
                  Cancel
                </Txt>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={savePrice}>
                <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                  Save
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function trendLabel(now: number, prev: number): string {
  if (prev === 0 && now === 0) return 'no activity';
  if (prev === 0) return 'new this month';
  const diff = now - prev;
  if (diff === 0) return 'same as last';
  return `${diff > 0 ? '+' : ''}${diff} vs last`;
}

function clientLabel(b: Booking): string {
  return b.other.displayName || (b.other.username ? `@${b.other.username}` : 'Sif user');
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
  children,
}: {
  title: string;
  onAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
          {title.toUpperCase()}
        </Txt>
        {onAll ? (
          <Pressable onPress={onAll} hitSlop={8}>
            <Txt variant="caption" color={Palette.accent}>
              View all
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
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
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
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  priceInput: {
    color: Palette.text,
    fontSize: 28,
    fontWeight: '700',
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, justifyContent: 'flex-end' },
  btn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceAlt,
  },
  btnPrimary: { backgroundColor: Palette.accent, borderColor: Palette.accent },
});
