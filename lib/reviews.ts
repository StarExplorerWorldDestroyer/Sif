import { fetchCardsByIds } from '@/lib/public';
import { supabase } from '@/lib/supabase';
import type { Review, UserSearchResult } from '@/types';

const fallbackCard = (id: string): UserSearchResult => ({
  id,
  username: null,
  displayName: 'Sif user',
  avatarUrl: '',
  privacy: 'public',
  isStylist: false,
});

/** All reviews for a stylist, newest first, with reviewers resolved. */
export async function fetchStylistReviews(stylistId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('stylist_reviews')
    .select('id, booking_id, stylist_id, client_id, rating, body, created_at, reply, reply_at')
    .eq('stylist_id', stylistId)
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const cards = await fetchCardsByIds(rows.map((r: any) => r.client_id));
  const byId = new Map(cards.map((c) => [c.id, c]));

  return rows.map((r: any) => ({
    id: r.id,
    bookingId: r.booking_id,
    stylistId: r.stylist_id,
    clientId: r.client_id,
    rating: r.rating,
    body: r.body ?? '',
    createdAt: r.created_at,
    author: byId.get(r.client_id) ?? fallbackCard(r.client_id),
    reply: r.reply ?? '',
    replyAt: r.reply_at ?? null,
  }));
}

/** Stylist posts or clears a reply to one of their reviews. */
export async function replyToReview(reviewId: string, reply: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_review_reply', {
    p_review_id: reviewId,
    p_reply: reply,
  });
  return { error: error?.message ?? null };
}

/** The current user's reviews keyed by booking id (to know what's reviewed). */
export async function fetchMyReviewsByBooking(): Promise<Map<string, { rating: number; body: string }>> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return new Map();
  const { data } = await supabase
    .from('stylist_reviews')
    .select('booking_id, rating, body')
    .eq('client_id', uid);
  return new Map((data ?? []).map((r: any) => [r.booking_id, { rating: r.rating, body: r.body ?? '' }]));
}

/** Create or update the current user's review for a completed booking. */
export async function submitReview(params: {
  bookingId: string;
  stylistId: string;
  rating: number;
  body: string;
}): Promise<{ error: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { error: 'You must be signed in to review.' };
  const { error } = await supabase.from('stylist_reviews').upsert(
    {
      booking_id: params.bookingId,
      stylist_id: params.stylistId,
      client_id: uid,
      rating: params.rating,
      body: params.body.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'booking_id' },
  );
  return { error: error?.message ?? null };
}
