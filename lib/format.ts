import type { Haircut } from '@/types';

/** Format a number as US currency, e.g. 45 -> "$45". */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format an ISO date string as "May 1, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type Stats = {
  totalSpent: number;
  average: number;
  totalTips: number;
  tipPercent: number;
  mostVisited: string | null;
};

/** Compute dashboard stats from a list of haircuts. */
export function computeStats(haircuts: Haircut[]): Stats {
  if (haircuts.length === 0) {
    return { totalSpent: 0, average: 0, totalTips: 0, tipPercent: 0, mostVisited: null };
  }

  const totalBase = haircuts.reduce((sum, h) => sum + h.price, 0);
  const totalTips = haircuts.reduce((sum, h) => sum + h.tip, 0);
  const totalSpent = totalBase + totalTips;
  const average = totalSpent / haircuts.length;
  const tipPercent = totalSpent > 0 ? (totalTips / totalSpent) * 100 : 0;

  // Most visited location by count.
  const counts = new Map<string, number>();
  for (const h of haircuts) {
    counts.set(h.location, (counts.get(h.location) ?? 0) + 1);
  }
  let mostVisited: string | null = null;
  let max = 0;
  for (const [location, count] of counts) {
    if (count > max) {
      max = count;
      mostVisited = location;
    }
  }

  return { totalSpent, average, totalTips, tipPercent, mostVisited };
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'All';

export const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', 'All'];

/** Keep only haircuts within the selected time range. */
export function filterByRange(haircuts: Haircut[], range: TimeRange): Haircut[] {
  if (range === 'All') return haircuts;

  const months = range === '1M' ? 1 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  return haircuts.filter((h) => new Date(h.date) >= cutoff);
}
