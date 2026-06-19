import { fetchMyBookings } from '@/lib/bookings';
import { fetchStylistReviews } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';
import type { Booking, Review } from '@/types';

/** One month's worth of earnings activity (for the trend chart). */
export type MonthBucket = { key: string; label: string; cuts: number; revenue: number };

/** A single cut credited to the stylist, reduced to earnings fields. */
export type EarningCut = { date: string; price: number; tip: number; cutType: string };

/** Time window the earnings/service stats are scoped to. */
export type DateRange = 'month' | 'quarter' | 'year' | 'all';

export const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

/** Revenue grouped by cut type. */
export type ServiceBucket = { cutType: string; revenue: number; count: number };

/** Two-hour columns for the busiest-times heatmap, covering 8a–8p. */
export const HEAT_BUCKETS: { label: string; start: number }[] = [
  { label: '8a', start: 8 },
  { label: '10a', start: 10 },
  { label: '12p', start: 12 },
  { label: '2p', start: 14 },
  { label: '4p', start: 16 },
  { label: '6p', start: 18 },
];

/** Appointment volume by weekday (0=Sun) and time bucket. */
export type Heatmap = {
  /** grid[day 0-6][bucket index] = appointment count. */
  grid: number[][];
  max: number;
  total: number;
  busiest: { day: number; bucket: number; count: number } | null;
};

/** New vs returning clients in one month. */
export type RetentionMonth = { key: string; label: string; newClients: number; returning: number };

/** Client retention trend + overall repeat rate. */
export type Retention = { monthly: RetentionMonth[]; repeatRate: number };

function heatBucket(hour: number): number {
  if (hour < HEAT_BUCKETS[0].start) return 0;
  const last = HEAT_BUCKETS.length - 1;
  if (hour >= HEAT_BUCKETS[last].start + 2) return last;
  return Math.min(last, Math.floor((hour - HEAT_BUCKETS[0].start) / 2));
}

/** Appointment heatmap from confirmed/completed bookings. */
export function bookingHeatmap(bookings: Booking[]): Heatmap {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(HEAT_BUCKETS.length).fill(0));
  let max = 0;
  let total = 0;
  let busiest: Heatmap['busiest'] = null;
  for (const b of bookings) {
    if (b.status !== 'confirmed' && b.status !== 'completed') continue;
    const d = new Date(b.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getDay();
    const bucket = heatBucket(d.getHours());
    const next = grid[day][bucket] + 1;
    grid[day][bucket] = next;
    total += 1;
    if (next > max) {
      max = next;
      busiest = { day, bucket, count: next };
    }
  }
  return { grid, max, total, busiest };
}

/** Last 6 months of new vs returning clients, plus the overall repeat rate. */
export function clientRetention(bookings: Booking[], now = new Date()): Retention {
  const real = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');

  // First appointment month per client + total visit count.
  const firstMonth = new Map<string, string>();
  const visits = new Map<string, number>();
  for (const b of real) {
    const d = new Date(b.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = monthKey(d);
    const prev = firstMonth.get(b.clientId);
    if (!prev || key < prev) firstMonth.set(b.clientId, key);
    visits.set(b.clientId, (visits.get(b.clientId) ?? 0) + 1);
  }

  const monthly: RetentionMonth[] = [];
  const index = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    index.set(key, monthly.length);
    monthly.push({
      key,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      newClients: 0,
      returning: 0,
    });
  }

  // Unique clients seen per month, classified as new (first month) or returning.
  const seen = new Map<string, Set<string>>();
  for (const b of real) {
    const d = new Date(b.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = monthKey(d);
    const at = index.get(key);
    if (at === undefined) continue;
    const set = seen.get(key) ?? new Set<string>();
    if (set.has(b.clientId)) continue;
    set.add(b.clientId);
    seen.set(key, set);
    if (firstMonth.get(b.clientId) === key) monthly[at].newClients += 1;
    else monthly[at].returning += 1;
  }

  const unique = visits.size;
  const repeat = [...visits.values()].filter((n) => n >= 2).length;
  return { monthly, repeatRate: unique > 0 ? repeat / unique : 0 };
}

/** Cuts that fall within the chosen date range (for export). */
export function cutsInRange(cuts: EarningCut[], range: DateRange, now = new Date()): EarningCut[] {
  const start = rangeStart(range, now);
  const startMs = start ? start.getTime() : -Infinity;
  return cuts.filter((c) => {
    const t = new Date(`${c.date}T00:00:00`).getTime();
    return Number.isFinite(t) && t >= startMs;
  });
}

/** Earnings figures for a chosen date range. */
export type RangeStats = {
  earned: number; // service + tips
  service: number;
  tips: number;
  count: number; // cuts performed in range
  avg: number; // earned / count
  byService: ServiceBucket[];
};

/** Everything the stylist dashboard needs that doesn't depend on the range. */
export type StylistDashboard = {
  // Ratings
  ratingAvg: number;
  ratingCount: number;
  /** Counts per star, index 0 = 1★ … index 4 = 5★. */
  ratingDist: number[];
  replyRate: number; // 0..1
  recentReviews: Review[];

  // Pipeline
  pending: Booking[];
  upcoming: Booking[];
  completedCount: number;
  responseRate: number; // 0..1
  completionRate: number; // 0..1

  // Clients
  uniqueClients: number;
  repeatClients: number;
  topClient: { name: string; count: number } | null;
  retention: Retention;

  // Scheduling
  heatmap: Heatmap;

  // Earnings (all-time + 6-month trend)
  earnedAllTime: number;
  cutsAllTime: number;
  monthly: MonthBucket[];

  // Raw cuts, for range-filtered stats computed on the client.
  cuts: EarningCut[];
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function clientName(b: Booking): string {
  return b.other.displayName || (b.other.username ? `@${b.other.username}` : 'Sif user');
}

/** Inclusive lower bound (local time) for a date range; null = no bound. */
export function rangeStart(range: DateRange, now = new Date()): Date | null {
  switch (range) {
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      return new Date(now.getFullYear(), now.getMonth() - (now.getMonth() % 3), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
      return null;
  }
}

/** Earnings + service breakdown for cuts within the chosen range. */
export function rangeStats(cuts: EarningCut[], range: DateRange, now = new Date()): RangeStats {
  const start = rangeStart(range, now);
  const startMs = start ? start.getTime() : -Infinity;
  const inRange = cuts.filter((c) => {
    const t = new Date(`${c.date}T00:00:00`).getTime();
    return Number.isFinite(t) && t >= startMs;
  });

  let service = 0;
  let tips = 0;
  const byTypeMap = new Map<string, ServiceBucket>();
  for (const c of inRange) {
    service += c.price;
    tips += c.tip;
    const type = c.cutType || 'Haircut';
    const bucket = byTypeMap.get(type) ?? { cutType: type, revenue: 0, count: 0 };
    bucket.revenue += c.price + c.tip;
    bucket.count += 1;
    byTypeMap.set(type, bucket);
  }
  const earned = service + tips;
  return {
    earned,
    service,
    tips,
    count: inRange.length,
    avg: inRange.length > 0 ? earned / inRange.length : 0,
    byService: [...byTypeMap.values()].sort((a, b) => b.revenue - a.revenue),
  };
}

/** Pure aggregation over a stylist's bookings (role === 'stylist'), reviews, and cuts. */
export function computeStylistDashboard(
  bookings: Booking[],
  reviews: Review[],
  cuts: EarningCut[],
): StylistDashboard {
  const now = Date.now();

  // ----- Ratings -----
  const ratingCount = reviews.length;
  const ratingDist = [0, 0, 0, 0, 0];
  let ratingSum = 0;
  let replied = 0;
  for (const r of reviews) {
    const idx = Math.min(5, Math.max(1, r.rating)) - 1;
    ratingDist[idx] += 1;
    ratingSum += r.rating;
    if (r.reply) replied += 1;
  }
  const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : 0;
  const replyRate = ratingCount > 0 ? replied / ratingCount : 0;

  // ----- Pipeline -----
  const pending = bookings
    .filter((b) => b.status === 'pending')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const upcoming = bookings
    .filter((b) => b.status === 'confirmed' && new Date(b.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const completed = bookings.filter((b) => b.status === 'completed');
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;

  const handled = bookings.filter((b) => b.status !== 'pending').length;
  const missed = bookings.filter(
    (b) => b.status === 'pending' && new Date(b.startsAt).getTime() < now,
  ).length;
  const responseRate = handled + missed > 0 ? handled / (handled + missed) : 1;

  const completionEligible = completed.length + cancelledCount;
  const completionRate = completionEligible > 0 ? completed.length / completionEligible : 1;

  // ----- Clients (real ones: confirmed or completed) -----
  const counts = new Map<string, { name: string; count: number }>();
  for (const b of bookings) {
    if (b.status !== 'confirmed' && b.status !== 'completed') continue;
    const entry = counts.get(b.clientId) ?? { name: clientName(b), count: 0 };
    entry.count += 1;
    counts.set(b.clientId, entry);
  }
  const clientEntries = [...counts.values()];
  const uniqueClients = clientEntries.length;
  const repeatClients = clientEntries.filter((c) => c.count >= 2).length;
  const topClient =
    clientEntries.length > 0 ? clientEntries.reduce((a, b) => (b.count > a.count ? b : a)) : null;

  // ----- Earnings trend (last 6 months from performed cuts) -----
  const monthly: MonthBucket[] = [];
  const base = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    monthly.push({
      key: monthKey(d),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      cuts: 0,
      revenue: 0,
    });
  }
  const monthByKey = new Map(monthly.map((m) => [m.key, m]));
  let earnedAllTime = 0;
  for (const c of cuts) {
    earnedAllTime += c.price + c.tip;
    const bucket = monthByKey.get(monthKey(new Date(`${c.date}T00:00:00`)));
    if (bucket) {
      bucket.cuts += 1;
      bucket.revenue += c.price + c.tip;
    }
  }

  return {
    ratingAvg,
    ratingCount,
    ratingDist,
    replyRate,
    recentReviews: reviews.slice(0, 3),
    pending,
    upcoming,
    completedCount: completed.length,
    responseRate,
    completionRate,
    uniqueClients,
    repeatClients,
    topClient,
    retention: clientRetention(bookings),
    heatmap: bookingHeatmap(bookings),
    earnedAllTime,
    cutsAllTime: cuts.length,
    monthly,
    cuts,
  };
}

/** Earnings rows for every cut credited to the current stylist. */
async function fetchEarningCuts(): Promise<EarningCut[]> {
  const { data } = await supabase.rpc('stylist_earnings');
  return (data ?? []).map((r: any) => ({
    date: r.cut_date,
    price: Number(r.price ?? 0),
    tip: Number(r.tip ?? 0),
    cutType: r.cut_type ?? 'Haircut',
  }));
}

/** Fetch + aggregate the dashboard for the given stylist (the current user). */
export async function fetchStylistDashboard(stylistId: string): Promise<StylistDashboard> {
  const [bookings, reviews, cuts] = await Promise.all([
    fetchMyBookings(),
    fetchStylistReviews(stylistId),
    fetchEarningCuts(),
  ]);
  return computeStylistDashboard(
    bookings.filter((b) => b.role === 'stylist'),
    reviews,
    cuts,
  );
}
