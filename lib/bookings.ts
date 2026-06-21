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
  return (data ?? []).map((row: any) => ({
    ...rowToCard(row),
    bio: row.bio ?? '',
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
  }));
}

/** A single stylist's directory card (or null). */
export async function fetchStylistCard(stylistId: string): Promise<StylistCard | null> {
  const cards = await fetchCardsByIds([stylistId]);
  const card = cards[0];
  if (!card) return null;
  return { ...card, bio: '', ratingAvg: 0, ratingCount: 0 };
}

/** A stylist's booking settings (defaults when unset). */
export async function fetchBookingSettings(stylistId: string): Promise<BookingSettings> {
  const { data } = await supabase
    .from('stylist_booking_settings')
    .select(
      'slot_minutes, accepts_bookings, deposit_enabled, deposit_type, deposit_value, buffer_before_minutes, buffer_after_minutes',
    )
    .eq('stylist_id', stylistId)
    .maybeSingle();
  return {
    slotMinutes: data?.slot_minutes ?? 60,
    acceptsBookings: data?.accepts_bookings ?? true,
    depositEnabled: data?.deposit_enabled ?? false,
    depositType: (data?.deposit_type as BookingSettings['depositType']) ?? 'percent',
    depositValue: Number(data?.deposit_value ?? 0),
    bufferBeforeMinutes: data?.buffer_before_minutes ?? 0,
    bufferAfterMinutes: data?.buffer_after_minutes ?? 0,
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
      deposit_enabled: settings.depositEnabled,
      deposit_type: settings.depositType,
      deposit_value: settings.depositValue,
      buffer_before_minutes: settings.bufferBeforeMinutes,
      buffer_after_minutes: settings.bufferAfterMinutes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stylist_id' },
  );
}

/** Deposit owed for a price under a stylist's policy (0 when disabled). */
export function computeDeposit(settings: BookingSettings, price: number): number {
  if (!settings.depositEnabled || price <= 0) return 0;
  const raw =
    settings.depositType === 'percent'
      ? (price * settings.depositValue) / 100
      : settings.depositValue;
  return Math.max(0, Math.min(price, Math.round(raw * 100) / 100));
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

/** Granularity (minutes) of candidate booking start times. */
export const SLOT_STEP = 15;

/** A blocked [start, end] window in epoch ms (booking time + its buffers). */
export type BusyInterval = { start: number; end: number };

/**
 * Compute bookable slots for a local calendar date. Candidate start times step
 * every `SLOT_STEP` minutes; a slot is taken if the appointment (plus its
 * before/after buffers) would overlap an existing booking's blocked window, run
 * past the availability window, or sit in the past.
 */
export function computeDaySlots(params: {
  windows: AvailabilityWindow[];
  dateISO: string; // yyyy-mm-dd (local)
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  busy: BusyInterval[];
  stepMinutes?: number;
  now?: Date;
}): BookingSlot[] {
  const { windows, dateISO, durationMinutes, busy } = params;
  const bufferBefore = params.bufferBeforeMinutes ?? 0;
  const bufferAfter = params.bufferAfterMinutes ?? 0;
  const step = params.stepMinutes ?? SLOT_STEP;
  const now = params.now ?? new Date();
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return [];
  const weekday = new Date(y, m - 1, d).getDay();
  const slots: BookingSlot[] = [];
  for (const w of windows.filter((win) => win.weekday === weekday)) {
    for (let start = w.startMin; start + durationMinutes <= w.endMin; start += step) {
      const dt = new Date(y, m - 1, d, Math.floor(start / 60), start % 60, 0, 0);
      const apptStart = dt.getTime();
      const apptEnd = apptStart + durationMinutes * 60_000;
      const blockStart = apptStart - bufferBefore * 60_000;
      const blockEnd = apptEnd + bufferAfter * 60_000;
      const overlaps = busy.some((b) => blockStart < b.end && b.start < blockEnd);
      slots.push({
        iso: dt.toISOString(),
        label: minutesToLabel(start),
        taken: overlaps || apptStart <= now.getTime(),
      });
    }
  }
  return slots.sort((a, b) => a.iso.localeCompare(b.iso));
}

/**
 * Active (pending/confirmed) blocked intervals for a stylist around a date,
 * each expanded by that booking's own before/after buffers.
 */
export async function fetchBusyIntervals(
  stylistId: string,
  dateISO: string,
): Promise<BusyInterval[]> {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return [];
  // Widen the query a day each side so long appointments/buffers that spill
  // across midnight are still considered.
  const from = new Date(y, m - 1, d - 1, 0, 0, 0, 0);
  const to = new Date(y, m - 1, d + 2, 0, 0, 0, 0);
  const { data } = await supabase
    .from('bookings')
    .select('starts_at, duration_minutes, buffer_before_minutes, buffer_after_minutes, status')
    .eq('stylist_id', stylistId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .in('status', ['pending', 'confirmed']);
  return (data ?? []).map((r: any) => {
    const start = new Date(r.starts_at).getTime();
    const before = (r.buffer_before_minutes ?? 0) * 60_000;
    const after = (r.buffer_after_minutes ?? 0) * 60_000;
    const dur = (r.duration_minutes ?? 60) * 60_000;
    return { start: start - before, end: start + dur + after };
  });
}

/** Create a booking request. Returns the id, or null (e.g. slot just taken). */
export async function createBooking(params: {
  stylistId: string;
  startsAtISO: string;
  durationMinutes: number;
  note: string;
  serviceId?: string | null;
  price?: number;
  depositAmount?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}): Promise<{ id: string | null; error: string | null }> {
  // price / deposit / buffers are set server-side from the stylist's service and
  // deposit policy (see set_booking_pricing trigger); anything sent here is
  // ignored, so a client can't book at a price it chose.
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      stylist_id: params.stylistId,
      starts_at: params.startsAtISO,
      duration_minutes: params.durationMinutes,
      note: params.note.trim(),
      service_id: params.serviceId ?? null,
    })
    .select('id')
    .single();
  if (error) {
    const taken = error.code === '23505' || error.code === '23P01';
    return { id: null, error: taken ? 'That time was just booked. Pick another slot.' : error.message };
  }
  return { id: data.id, error: null };
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  await supabase.from('bookings').update({ status }).eq('id', id);
}

/** Set what the stylist charged for a booking (used for earnings). */
export async function updateBookingPrice(id: string, price: number): Promise<void> {
  await supabase.rpc('set_booking_price', { p_booking_id: id, p_price: price });
}

/** Cancel a booking with an optional reason (visible to the other party). */
export async function cancelBooking(id: string, reason: string): Promise<void> {
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancel_reason: reason.trim() })
    .eq('id', id);
}

/**
 * Move a booking to a new time. Resets it to pending (re-confirmation needed).
 * Changing `starts_at` also clears any sent reminders via a DB trigger, so the
 * configured reminders fire again for the new time. Errors if the slot is taken.
 */
export async function rescheduleBooking(
  id: string,
  startsAtISO: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('bookings')
    .update({ starts_at: startsAtISO, status: 'pending' })
    .eq('id', id);
  if (error) {
    const taken = error.code === '23505' || error.code === '23P01';
    return { error: taken ? 'That time was just booked. Pick another slot.' : error.message };
  }
  return { error: null };
}

/** All bookings involving the current user, with the other party resolved. */
export async function fetchMyBookings(): Promise<Booking[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from('bookings')
    .select('*, service:stylist_services(name)')
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

  return rows.map((r: any) => rowToBooking(r, uid, byId.get(r.client_id === uid ? r.stylist_id : r.client_id) ?? fallback(r.client_id === uid ? r.stylist_id : r.client_id)));
}

function rowToBooking(r: any, uid: string, other: UserSearchResult): Booking {
  const role: 'client' | 'stylist' = r.client_id === uid ? 'client' : 'stylist';
  return {
    id: r.id,
    stylistId: r.stylist_id,
    clientId: r.client_id,
    startsAt: r.starts_at,
    durationMinutes: r.duration_minutes,
    status: r.status as BookingStatus,
    note: r.note ?? '',
    cancelReason: r.cancel_reason ?? '',
    price: Number(r.price ?? 0),
    serviceId: r.service_id ?? null,
    serviceName: r.service?.name ?? '',
    depositAmount: Number(r.deposit_amount ?? 0),
    amountPaid: Number(r.amount_paid ?? 0),
    paymentStatus: (r.payment_status as Booking['paymentStatus']) ?? 'unpaid',
    createdAt: r.created_at,
    role,
    other,
  };
}

/** A single booking the current user participates in, or null. */
export async function fetchBooking(id: string): Promise<Booking | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from('bookings')
    .select('*, service:stylist_services(name)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const otherId = data.client_id === uid ? data.stylist_id : data.client_id;
  const cards = await fetchCardsByIds([otherId]);
  const other: UserSearchResult = cards[0] ?? {
    id: otherId,
    username: null,
    displayName: 'Sif user',
    avatarUrl: '',
    privacy: 'public',
    isStylist: false,
  };
  return rowToBooking(data, uid, other);
}
