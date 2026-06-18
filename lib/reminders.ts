import type { ReminderOrdinal, ReminderRule, ReminderUnit } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDINALS: { value: ReminderOrdinal; label: string }[] = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' },
];

export const REMINDER_WEEKDAYS = WEEKDAYS_SHORT;
export const REMINDER_ORDINALS = ORDINALS;

export function weekdayName(weekday: number): string {
  return WEEKDAYS[((weekday % 7) + 7) % 7];
}

function ordinalLabel(ordinal: ReminderOrdinal): string {
  return ORDINALS.find((o) => o.value === ordinal)?.label ?? 'First';
}

/** Midnight (local) for a date, so day comparisons ignore the time of day. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse an ISO `yyyy-mm-dd` (or full ISO) string as a local-midnight date. */
function parseDate(iso: string): Date {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return startOfDay(new Date(iso));
  return new Date(y, m - 1, d);
}

/** ISO `yyyy-mm-dd` for a date in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a Date as "Aug 15, 2026" in local time. Unlike the shared
 * `formatDate`, this never shifts the day across timezones because it reads the
 * date's own local Y/M/D rather than re-parsing an ISO string as UTC.
 */
export function formatReminderDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Add an interval to a date, clamping the day when a month is shorter. */
export function addUnit(date: Date, n: number, unit: ReminderUnit): Date {
  if (unit === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  if (unit === 'week') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n * 7);
  const target = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

/** The date of the Nth `weekday` in a given month (ordinal -1 = last). */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  ordinal: ReminderOrdinal,
  weekday: number,
): Date {
  if (ordinal === -1) {
    const last = new Date(year, month + 1, 0);
    const offset = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - offset);
  }
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (ordinal - 1) * 7);
}

/**
 * The occurrence just before and the first occurrence on/after `today`.
 * `prev` is null when nothing is scheduled before today (e.g. a future start
 * date or a one-off still ahead); `next` is null when a one-off has passed.
 */
export function prevNextOccurrences(
  rule: ReminderRule,
  today: Date,
): { prev: Date | null; next: Date | null } {
  const t = startOfDay(today);

  if (rule.kind === 'one_off') {
    const date = parseDate(rule.date);
    return date < t ? { prev: date, next: null } : { prev: null, next: date };
  }

  if (rule.kind === 'nth_weekday') {
    let prev: Date | null = null;
    let cursor = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    for (let i = 0; i < 48; i++) {
      const occ = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), rule.ordinal, rule.weekday);
      if (occ < t) prev = occ;
      else return { prev, next: occ };
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return { prev, next: null };
  }

  // interval: occurrences are anchor, anchor+period, anchor+2*period, ...
  const every = Math.max(1, Math.round(rule.every));
  const anchor = parseDate(rule.anchor);
  if (anchor >= t) return { prev: null, next: anchor };

  let prev: Date | null = null;
  let occ = anchor;
  for (let i = 0; i < 6000 && occ < t; i++) {
    prev = occ;
    occ = addUnit(occ, every, rule.unit);
  }
  return { prev, next: occ };
}

/**
 * The next date this reminder is due on or after `from`. Returns null only when
 * a one-off date has fully passed.
 */
export function nextReminderDate(rule: ReminderRule, from: Date = new Date()): Date | null {
  return prevNextOccurrences(rule, from).next;
}

export type ReminderStatus = 'overdue' | 'due' | 'soon' | 'scheduled';

export type ReminderState = {
  /** The date the user should act on (a missed past date when overdue). */
  date: Date;
  daysUntil: number;
  status: ReminderStatus;
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

/**
 * Resolve a reminder into an actionable state. A scheduled date that has
 * already passed counts as *overdue* only if no cut has been logged since it
 * (logging a cut clears the nudge and rolls to the next occurrence).
 */
export function dueReminder(
  rule: ReminderRule,
  lastCutISO: string | null,
  now: Date = new Date(),
): ReminderState | null {
  const { prev, next } = prevNextOccurrences(rule, now);
  const lastCut = lastCutISO ? parseDate(lastCutISO) : null;

  if (prev && (!lastCut || lastCut < prev)) {
    const daysUntil = daysBetween(prev, now);
    return { date: prev, daysUntil, status: daysUntil === 0 ? 'due' : 'overdue' };
  }

  if (!next) return null;
  const daysUntil = daysBetween(next, now);
  let status: ReminderStatus;
  if (daysUntil <= 0) status = 'due';
  else if (daysUntil <= 3) status = 'soon';
  else status = 'scheduled';
  return { date: next, daysUntil, status };
}

/** Short human description of a rule, e.g. "Every 2 weeks". */
export function describeRule(rule: ReminderRule): string {
  if (rule.kind === 'one_off') return `On ${formatReminderDate(parseDate(rule.date))}`;
  if (rule.kind === 'nth_weekday') {
    return `${ordinalLabel(rule.ordinal)} ${weekdayName(rule.weekday)} of each month`;
  }
  const every = Math.max(1, Math.round(rule.every));
  if (every === 1) return `Every ${rule.unit}`;
  return `Every ${every} ${rule.unit}s`;
}

/** A relative phrase like "in 5 days", "today", or "3 days ago". */
export function relativeDays(daysUntil: number): string {
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  if (daysUntil === -1) return 'yesterday';
  if (daysUntil > 0) return `in ${daysUntil} days`;
  return `${Math.abs(daysUntil)} days ago`;
}
