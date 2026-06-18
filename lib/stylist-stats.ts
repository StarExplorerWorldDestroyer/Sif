import { fetchMyBookings } from '@/lib/bookings';
import { fetchStylistReviews } from '@/lib/reviews';
import type { Booking, Review } from '@/types';

/** One month's worth of completed-appointment activity. */
export type MonthBucket = { key: string; label: string; appts: number; revenue: number };

/** Everything the stylist dashboard needs, derived from bookings + reviews. */
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
  cancelledCount: number;
  declinedCount: number;
  responseRate: number; // 0..1, requests you didn't leave hanging
  completionRate: number; // 0..1, confirmed appts that got completed

  // Activity
  apptThisMonth: number;
  apptLastMonth: number;
  monthly: MonthBucket[]; // oldest → newest, last 6 months

  // Clients
  uniqueClients: number;
  repeatClients: number;
  topClient: { name: string; count: number } | null;

  // Earnings
  totalRevenue: number;
  avgRevenue: number;
  completed: Booking[]; // completed appts, newest first (for pricing)
  unpricedCount: number;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function clientName(b: Booking): string {
  return b.other.displayName || (b.other.username ? `@${b.other.username}` : 'Sif user');
}

/** Pure aggregation over a stylist's bookings (role === 'stylist') + reviews. */
export function computeStylistDashboard(bookings: Booking[], reviews: Review[]): StylistDashboard {
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
  const completed = bookings
    .filter((b) => b.status === 'completed')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;
  const declinedCount = bookings.filter((b) => b.status === 'declined').length;

  const handled = bookings.filter((b) => b.status !== 'pending').length;
  const missed = bookings.filter(
    (b) => b.status === 'pending' && new Date(b.startsAt).getTime() < now,
  ).length;
  const responseRate = handled + missed > 0 ? handled / (handled + missed) : 1;

  const completionEligible = completed.length + cancelledCount;
  const completionRate = completionEligible > 0 ? completed.length / completionEligible : 1;

  // ----- Activity (last 6 months by completed appt date) -----
  const monthly: MonthBucket[] = [];
  const base = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    monthly.push({
      key: monthKey(d),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      appts: 0,
      revenue: 0,
    });
  }
  const monthByKey = new Map(monthly.map((m) => [m.key, m]));
  for (const b of completed) {
    const bucket = monthByKey.get(monthKey(new Date(b.startsAt)));
    if (bucket) {
      bucket.appts += 1;
      bucket.revenue += b.price;
    }
  }
  const thisKey = monthKey(new Date(base.getFullYear(), base.getMonth(), 1));
  const lastKey = monthKey(new Date(base.getFullYear(), base.getMonth() - 1, 1));
  const apptThisMonth = monthByKey.get(thisKey)?.appts ?? 0;
  const apptLastMonth = monthByKey.get(lastKey)?.appts ?? 0;

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
    clientEntries.length > 0
      ? clientEntries.reduce((a, b) => (b.count > a.count ? b : a))
      : null;

  // ----- Earnings -----
  const totalRevenue = completed.reduce((s, b) => s + b.price, 0);
  const avgRevenue = completed.length > 0 ? totalRevenue / completed.length : 0;
  const unpricedCount = completed.filter((b) => b.price <= 0).length;

  return {
    ratingAvg,
    ratingCount,
    ratingDist,
    replyRate,
    recentReviews: reviews.slice(0, 3),
    pending,
    upcoming,
    completedCount: completed.length,
    cancelledCount,
    declinedCount,
    responseRate,
    completionRate,
    apptThisMonth,
    apptLastMonth,
    monthly,
    uniqueClients,
    repeatClients,
    topClient,
    totalRevenue,
    avgRevenue,
    completed,
    unpricedCount,
  };
}

/** Fetch + aggregate the dashboard for the given stylist (the current user). */
export async function fetchStylistDashboard(stylistId: string): Promise<StylistDashboard> {
  const [bookings, reviews] = await Promise.all([
    fetchMyBookings(),
    fetchStylistReviews(stylistId),
  ]);
  return computeStylistDashboard(
    bookings.filter((b) => b.role === 'stylist'),
    reviews,
  );
}
