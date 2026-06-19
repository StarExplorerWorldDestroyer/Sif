import type { Haircut, HaircutUpdate } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A logged haircut, as a moment in the journal. */
export type JournalCut = {
  kind: 'cut';
  id: string;
  haircutId: string;
  /** ISO date the cut happened. */
  date: string;
  photoUri: string | null;
  cutType: string;
  location: string;
  stylistName: string;
  price: number;
  tip: number;
  photoCount: number;
  /** Chronological position, 1 = your first ever cut. */
  ordinal: number;
  /** Optional milestone to celebrate inline, e.g. "First cut" or "Cut #10". */
  milestone: string | null;
};

/** A grow-out follow-up photo, as a moment in the journal. */
export type JournalGrowout = {
  kind: 'growout';
  id: string;
  haircutId: string;
  /** ISO date the photo was taken. */
  date: string;
  photoUri: string;
  note: string;
  /** Days after the parent cut this photo was taken (>= 0), or null if unknown. */
  daysAfterCut: number | null;
  /** The parent cut's type, for context. */
  cutType: string;
};

export type JournalEntry = JournalCut | JournalGrowout;

/** Entries grouped under a year heading, newest year first. */
export type JournalSection = {
  year: string;
  entries: JournalEntry[];
};

export type JournalSummary = {
  cutCount: number;
  growoutCount: number;
  /** Human label of the span, e.g. "Mar 2024 – Jun 2026", or "". */
  span: string;
  /** Total days between the first and last entry. */
  spanDays: number;
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function cutToEntry(h: Haircut, ordinal: number): JournalCut {
  const stylistName =
    h.stylist?.name && h.stylist.name !== 'Unknown stylist' ? h.stylist.name : '';
  let milestone: string | null = null;
  if (ordinal === 1) milestone = 'First cut';
  else if (ordinal > 0 && ordinal % 10 === 0) milestone = `Cut #${ordinal}`;
  return {
    kind: 'cut',
    id: `cut-${h.id}`,
    haircutId: h.id,
    date: h.date,
    photoUri: h.photos.find((p) => p.uri)?.uri ?? null,
    cutType: h.cutType || 'Haircut',
    location: h.location,
    stylistName,
    price: h.price,
    tip: h.tip,
    photoCount: h.photos.length,
    ordinal,
    milestone,
  };
}

/**
 * Weave cuts and their grow-out photos into a single chronological story,
 * grouped by year (newest first). Cuts are numbered in the order they happened
 * so milestones like "first cut" and "cut #10" can be surfaced inline.
 */
export function buildJournal(haircuts: Haircut[], updates: HaircutUpdate[]): JournalSection[] {
  const byDateAsc = [...haircuts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const ordinalOf = new Map<string, number>();
  byDateAsc.forEach((h, i) => ordinalOf.set(h.id, i + 1));

  const cutById = new Map<string, Haircut>();
  haircuts.forEach((h) => cutById.set(h.id, h));

  const entries: JournalEntry[] = haircuts.map((h) => cutToEntry(h, ordinalOf.get(h.id) ?? 0));

  for (const u of updates) {
    if (!u.uri) continue;
    const parent = cutById.get(u.haircutId);
    let daysAfterCut: number | null = null;
    if (parent) {
      const diff = Math.round(
        (startOfDay(new Date(u.takenOn)) - startOfDay(new Date(parent.date))) / DAY_MS,
      );
      daysAfterCut = diff >= 0 ? diff : null;
    }
    entries.push({
      kind: 'growout',
      id: `up-${u.id}`,
      haircutId: u.haircutId,
      date: u.takenOn,
      photoUri: u.uri,
      note: u.note,
      daysAfterCut,
      cutType: parent?.cutType || 'Haircut',
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sections: JournalSection[] = [];
  const index = new Map<string, number>();
  for (const e of entries) {
    const d = new Date(e.date);
    const year = Number.isNaN(d.getTime()) ? '—' : String(d.getFullYear());
    let at = index.get(year);
    if (at === undefined) {
      at = sections.length;
      index.set(year, at);
      sections.push({ year, entries: [] });
    }
    sections[at].entries.push(e);
  }
  return sections;
}

/** Headline numbers for the top of the journal. */
export function journalSummary(haircuts: Haircut[], updates: HaircutUpdate[]): JournalSummary {
  const times = [
    ...haircuts.map((h) => new Date(h.date).getTime()),
    ...updates.filter((u) => !!u.uri).map((u) => new Date(u.takenOn).getTime()),
  ].filter((t) => !Number.isNaN(t));

  let span = '';
  let spanDays = 0;
  if (times.length >= 1) {
    const min = Math.min(...times);
    const max = Math.max(...times);
    spanDays = Math.round((max - min) / DAY_MS);
    const fmt = (t: number) =>
      new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    span = min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  }

  return {
    cutCount: haircuts.length,
    growoutCount: updates.filter((u) => !!u.uri).length,
    span,
    spanDays,
  };
}

/** Friendly "2 weeks later" label for a grow-out photo's age. */
export function describeDaysAfter(days: number): string {
  if (days <= 0) return 'Same day';
  if (days === 1) return '1 day later';
  if (days < 14) return `${days} days later`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} weeks later`;
  const months = Math.round(days / 30.44);
  return `${months} month${months === 1 ? '' : 's'} later`;
}
