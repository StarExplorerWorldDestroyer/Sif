import type { Haircut } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CadenceStatus = 'insufficient' | 'overdue' | 'due_soon' | 'on_track';

export type CutCadence = {
  status: CadenceStatus;
  /** Typical days between cuts (median of recent intervals). */
  cadenceDays: number;
  /** Number of intervals used to compute the cadence. */
  sampleSize: number;
  /** ISO date of the most recent cut, or null if none. */
  lastDate: string | null;
  daysSinceLast: number;
  /** ISO date we predict the next cut is due. */
  predictedNext: string | null;
  /** Days until due (negative = overdue). */
  daysUntilDue: number;
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Work out how often someone gets a cut and whether they're due, using the
 * median gap between their recent cuts. Median (not mean) keeps the estimate
 * stable when there's an unusually long or short gap.
 */
export function computeCadence(haircuts: Haircut[], now: Date = new Date()): CutCadence {
  const dates = haircuts
    .map((h) => startOfDay(new Date(h.date)))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  const empty: CutCadence = {
    status: 'insufficient',
    cadenceDays: 0,
    sampleSize: 0,
    lastDate: dates.length ? new Date(dates[dates.length - 1]).toISOString() : null,
    daysSinceLast: 0,
    predictedNext: null,
    daysUntilDue: 0,
  };

  if (dates.length < 2) return empty;

  // Gaps (in days) between consecutive cuts; use the most recent 6.
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const gap = Math.round((dates[i] - dates[i - 1]) / DAY_MS);
    if (gap >= 1) intervals.push(gap);
  }
  if (intervals.length === 0) return empty;

  const recent = intervals.slice(-6);
  const cadenceDays = Math.round(median(recent));
  const lastMs = dates[dates.length - 1];
  const today = startOfDay(now);
  const daysSinceLast = Math.round((today - lastMs) / DAY_MS);
  const daysUntilDue = cadenceDays - daysSinceLast;
  const predictedNext = new Date(lastMs + cadenceDays * DAY_MS).toISOString();

  const dueSoonWindow = Math.max(3, Math.round(cadenceDays * 0.15));
  let status: CadenceStatus;
  if (daysUntilDue < 0) status = 'overdue';
  else if (daysUntilDue <= dueSoonWindow) status = 'due_soon';
  else status = 'on_track';

  return {
    status,
    cadenceDays,
    sampleSize: recent.length,
    lastDate: new Date(lastMs).toISOString(),
    daysSinceLast,
    predictedNext,
    daysUntilDue,
  };
}

export type MonthBucket = { key: string; label: string; total: number };

/**
 * Total spend (price + tip) per calendar month for the last `monthsBack`
 * months, oldest first. Always returns a full, gap-free series so charts have
 * a stable shape even in quiet months.
 */
export function monthlySpend(
  haircuts: Haircut[],
  monthsBack: number = 6,
  now: Date = new Date(),
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const index = new Map<string, number>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    index.set(key, buckets.length);
    buckets.push({ key, label: d.toLocaleDateString('en-US', { month: 'short' }), total: 0 });
  }
  for (const h of haircuts) {
    const d = new Date(h.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const at = index.get(key);
    if (at !== undefined) buckets[at].total += h.price + h.tip;
  }
  return buckets;
}

export type Insights = {
  cadence: CutCadence;
  totalSpent: number;
  avgPerCut: number;
  avgPerMonth: number;
  projectedAnnual: number;
  tipPercent: number;
  cutsPerYear: number;
  mostVisited: string | null;
  topStylist: string | null;
  monthly: MonthBucket[];
};

function topByCount(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let max = 0;
  for (const [k, c] of counts) {
    if (c > max) {
      max = c;
      best = k;
    }
  }
  return best;
}

/** Roll the cut history up into the numbers shown on the Insights screen. */
export function computeInsights(haircuts: Haircut[], now: Date = new Date()): Insights {
  const cadence = computeCadence(haircuts, now);
  const totalBase = haircuts.reduce((s, h) => s + h.price, 0);
  const totalTips = haircuts.reduce((s, h) => s + h.tip, 0);
  const totalSpent = totalBase + totalTips;
  const avgPerCut = haircuts.length ? totalSpent / haircuts.length : 0;
  const tipPercent = totalSpent > 0 ? (totalTips / totalSpent) * 100 : 0;

  // Months spanned between the first and last cut (at least 1).
  const times = haircuts
    .map((h) => new Date(h.date).getTime())
    .filter((t) => !Number.isNaN(t));
  let monthsSpan = 1;
  if (times.length >= 2) {
    const span = (Math.max(...times) - Math.min(...times)) / DAY_MS;
    monthsSpan = Math.max(1, span / 30.44);
  }
  const avgPerMonth = totalSpent / monthsSpan;

  const cutsPerYear = cadence.cadenceDays > 0 ? 365 / cadence.cadenceDays : 0;
  // Prefer cadence-based projection; fall back to monthly average.
  const projectedAnnual = cutsPerYear > 0 ? cutsPerYear * avgPerCut : avgPerMonth * 12;

  return {
    cadence,
    totalSpent,
    avgPerCut,
    avgPerMonth,
    projectedAnnual,
    tipPercent,
    cutsPerYear,
    mostVisited: topByCount(haircuts.map((h) => h.location)),
    topStylist: topByCount(haircuts.map((h) => h.stylist?.name).filter((n): n is string => !!n)),
    monthly: monthlySpend(haircuts, 6, now),
  };
}

/** Friendly "every ~4 weeks" style description of a cadence in days. */
export function describeCadence(days: number): string {
  if (days <= 0) return '';
  if (days < 14) return `every ${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `every ~${weeks} weeks`;
  const months = Math.round(days / 30.44);
  return `every ~${months} month${months === 1 ? '' : 's'}`;
}
