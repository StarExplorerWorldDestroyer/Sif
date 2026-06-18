import { fetchCardsByIds } from '@/lib/public';
import { supabase } from '@/lib/supabase';
import type {
  AvailabilityWindow,
  Booking,
  BookingSettings,
  BookingSlot,
  BookingStatus,
  StylistCard,
  UserSearchResult,
} from '@/types';

function rowToCard(row: any): UserSearchResult {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    avatarUrl: row.avatar_url ?? '',
    privacy: (row.privacy as UserSearchResult['privacy']) ?? 'public',
    isStylist: row.is_stylist ?? false,
  };
}

/** Browse bookable stylists, optionally filtered by name/username. */
export async function fetchStylists(query?: string): Promise<StylistCard[]> {
  const q = query?.trim() || null;
  const { data } = await supabase.rpc('list_stylists', { q });
  return (data ?? []).map((row: any) => ({ ...rowToCard(row), bio: row.bio ?? '' }));
}

/** A single stylist's directory card (or null). */
export async function fetchStylistCard(stylistId: string): Promise<StylistCard | null> {
  const cards = await fetchCardsByIds([stylistId]);
  const card = cards[0];
  if (!card) return null;
  return { ...card, bio: '' };
}

/** A stylist's booking settings (defaults when unset). */
export async function fetchBookingSettings(stylistId: string): Promise<BookingSettings> {
  const { data } = await supabase
    .from('stylist_booking_settings')
    .select('slot_minutes, accepts_bookings')
    .eq('stylist_id', stylistId)
    .maybeSingle();
  return {
    slotMinutes: data?.slot_minutes ?? 60,
    acceptsBookings: data?.accepts_bookings ?? true,
  };
}

export async function saveBookingSettings(settings: BookingSettings): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await supabase.from('stylist_booking_settings').upsert(
    {
      stylist_id: uid,
      slot_minutes: settings.slotMinutes,
      accepts_bookings: settings.acceptsBookings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stylist_id' },
  );
}

export async function fetchAvailability(stylistId: string): Promise<AvailabilityWindow[]> {
  const { data } = await supabase
    .from('stylist_availability')
    .select('id, weekday, start_min, end_min')
    .eq('stylist_id', stylistId)
    .order('weekday', { ascending: true })
    .order('start_min', { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    weekday: r.weekday,
    startMin: r.start_min,
    endMin: r.end_min,
  }));
}

/** Replace the current stylist's availability windows with the given set. */
export async function saveAvailability(
  windows: Omit<AvailabilityWindow, 'id'>[],
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await supabase.from('stylist_availability').delete().eq('stylist_id', uid);
  if (windows.length > 0) {
    await supabase.from('stylist_availability').insert(
      windows.map((w) => ({
        stylist_id: uid,
        weekday: w.weekday,
        start_min: w.startMin,
        end_min: w.endMin,
      })),
    );
  }
}

function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Compute bookable slots for a local calendar date from a stylist's weekly
 * availability, excluding already-taken starts and times in the past.
 */
export function computeDaySlots(params: {
  windows: AvailabilityWindow[];
  dateISO: string; // yyyy-mm-dd (local)
  slotMinutes: number;
  takenEpochs: Set<number>;
  now?: Date;
}): BookingSlot[] {
  const { windows, dateISO, slotMinutes, takenEpochs } = params;
  const now = params.now ?? new Date();
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return [];
  const weekday = new Date(y, m - 1, d).getDay();
  const slots: BookingSlot[] = [];
  for (const w of windows.filter((win) => win.weekday === weekday)) {
    for (let start = w.startMin; start + slotMinutes <= w.endMin; start += slotMinutes) {
      const dt = new Date(y, m - 1, d, Math.floor(start / 60), start % 60, 0, 0);
      const epoch = dt.getTime();
      slots.push({
        iso: dt.toISOString(),
        label: minutesToLabel(start),
        taken: takenEpochs.has(epoch) || epoch <= now.getTime(),
      });
    }
  }
  return slots.sort((a, b) => a.iso.localeCompare(b.iso));
}

/** Active (pending/confirmed) booking start epochs for a stylist on a date. */
export async function fetchTakenSlots(stylistId: string, dateISO: string): Promise<Set<number>> {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return new Set();
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const { data } = await supabase
    .from('bookings')
    .select('starts_at, status')
    .eq('stylist_id', stylistId)
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString())
    .in('status', ['pending', 'confirmed']);
  return new Set((data ?? []).map((r: any) => new Date(r.starts_at).getTime()));
}

/** Create a booking request. Returns the id, or null (e.g. slot just taken). */
export async function createBooking(
  stylistId: string,
  startsAtISO: string,
  durationMinutes: number,
  note: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      stylist_id: stylistId,
      starts_at: startsAtISO,
      duration_minutes: durationMinutes,
      note: note.trim(),
    })
    .select('id')
    .single();
  if (error) {
    const taken = error.code === '23505';
    return { id: null, error: taken ? 'That time was just booked. Pick another slot.' : error.message };
  }
  return { id: data.id, error: null };
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  await supabase.from('bookings').update({ status }).eq('id', id);
}

/** All bookings involving the current user, with the other party resolved. */
export async function fetchMyBookings(): Promise<Booking[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .or(`client_id.eq.${uid},stylist_id.eq.${uid}`)
    .order('starts_at', { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const otherIds = rows.map((r: any) => (r.client_id === uid ? r.stylist_id : r.client_id));
  const cards = await fetchCardsByIds(otherIds);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const fallback = (id: string): UserSearchResult => ({
    id,
    username: null,
    displayName: 'Sif user',
    avatarUrl: '',
    privacy: 'public',
    isStylist: false,
  });

  return rows.map((r: any) => {
    const role: 'client' | 'stylist' = r.client_id === uid ? 'client' : 'stylist';
    const otherId = role === 'client' ? r.stylist_id : r.client_id;
    return {
      id: r.id,
      stylistId: r.stylist_id,
      clientId: r.client_id,
      startsAt: r.starts_at,
      durationMinutes: r.duration_minutes,
      status: r.status as BookingStatus,
      note: r.note ?? '',
      createdAt: r.created_at,
      role,
      other: byId.get(otherId) ?? fallback(otherId),
    };
  });
}
