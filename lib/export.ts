import { Platform, Share } from 'react-native';

import type { EarningCut } from '@/lib/stylist-stats';

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string of earnings rows (one per cut) with a totals row. */
export function earningsCsv(cuts: EarningCut[]): string {
  const header = ['Date', 'Service', 'Price', 'Tip', 'Total'];
  const rows = [...cuts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => [c.date, c.cutType || 'Haircut', c.price.toFixed(2), c.tip.toFixed(2), (c.price + c.tip).toFixed(2)]);
  const service = cuts.reduce((s, c) => s + c.price, 0);
  const tips = cuts.reduce((s, c) => s + c.tip, 0);
  const totals = ['Total', '', service.toFixed(2), tips.toFixed(2), (service + tips).toFixed(2)];
  return [header, ...rows, totals].map((r) => r.map(csvCell).join(',')).join('\n');
}

/**
 * Save/share a CSV. On web this downloads a file; on native it opens the share
 * sheet with the CSV contents. Returns false if there was nothing to do.
 */
export function exportCsv(filename: string, csv: string): boolean {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }
  Share.share({ title: filename, message: csv });
  return true;
}
