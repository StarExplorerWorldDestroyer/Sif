/** Shared data types for the Haircuts app. */

/** Camera angle a photo was taken from. `other` covers anything unlabeled. */
export type PhotoAngle = 'front' | 'top' | 'left' | 'right' | 'back' | 'other';

/** Human-readable labels and ordering for the angle tags. */
export const PHOTO_ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
  { value: 'back', label: 'Back' },
  { value: 'other', label: 'Other' },
];

export function angleLabel(angle: PhotoAngle): string {
  return PHOTO_ANGLES.find((a) => a.value === angle)?.label ?? 'Other';
}

export type Photo = {
  id: string;
  /** File URI (permanent app storage) or remote URL. */
  uri: string;
  angle: PhotoAngle;
  note: string;
};

/** A follow-up entry on a haircut: tracks how it grew out / aged over time. */
export type HaircutUpdate = {
  id: string;
  haircutId: string;
  uri: string;
  note: string;
  /** ISO date the photo was taken. */
  takenOn: string;
  createdAt: string;
};

export type Units = 'in' | 'cm';

/** Who can view something. */
export type Privacy = 'public' | 'connections' | 'private';

/** Per-post visibility ('private' means only the owner). */
export type PostVisibility = 'public' | 'connections' | 'private';

export const PRIVACY_OPTIONS: { value: Privacy; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone can find and view your profile.' },
  { value: 'connections', label: 'Connections', hint: 'Only people you’ve connected with.' },
  { value: 'private', label: 'Private', hint: 'Hidden from everyone but you.' },
];

export const POST_VISIBILITY_OPTIONS: { value: PostVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'connections', label: 'Connections' },
  { value: 'private', label: 'Only me' },
];

export type Post = {
  id: string;
  haircutId: string;
  caption: string;
  createdAt: string;
  /** Snapshot of the haircut's primary photo at post time (safe to show publicly). */
  photoUrl: string;
  /** Snapshot of the haircut's cut type at post time. */
  cutType: string;
  visibility: PostVisibility;
  /** User id of a tagged/credited stylist, if any. */
  stylistId: string | null;
};

/** A public-facing profile shown on shareable pages (no private fields). */
export type PublicProfile = {
  id: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string;
  instagram?: string;
  website?: string;
  privacy?: Privacy;
  isStylist?: boolean;
};

/** Follower / following counts for a profile. */
export type FollowCounts = { followers: number; following: number };

/** Minimal, privacy-safe profile card used in search results and gated views. */
export type UserSearchResult = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string;
  privacy: Privacy;
  isStylist: boolean;
};

/** Your relationship to another user, from your point of view. */
export type ConnectionStatus =
  | 'none'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'connected';

/** Kinds of in-app notification. */
export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'follow'
  | 'pending_cut'
  | 'post_tag'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'booking_requested'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'booking_rescheduled'
  | 'review_received'
  | 'review_reply';

/** An in-app notification, with the acting user resolved for display. */
export type AppNotification = {
  id: string;
  type: NotificationType;
  actor: UserSearchResult | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
};

/** A public post shown on shareable pages, joined with its author. */
export type PublicPost = {
  id: string;
  caption: string;
  photoUrl: string;
  cutType: string;
  createdAt: string;
  author: PublicProfile;
  /** Tagged/credited stylist, resolved for display (null if none). */
  stylist: UserSearchResult | null;
  likeCount: number;
  commentCount: number;
  /** Whether the current viewer has liked this post. */
  likedByMe: boolean;
};

/** A bookable stylist shown in the directory (search-card plus a short bio). */
export type StylistCard = UserSearchResult & {
  bio: string;
  /** Average rating (1–5), or 0 when there are no reviews yet. */
  ratingAvg: number;
  /** Number of reviews backing the average. */
  ratingCount: number;
};

/** A client's review of a completed booking, with its author resolved. */
export type Review = {
  id: string;
  bookingId: string;
  stylistId: string;
  clientId: string;
  rating: number;
  body: string;
  createdAt: string;
  /** The reviewer, resolved for display. */
  author: UserSearchResult;
  /** The stylist's public reply, or '' when none. */
  reply: string;
  /** ISO timestamp of the reply, or null. */
  replyAt: string | null;
};

/** A recurring weekly availability window for a stylist. */
export type AvailabilityWindow = {
  id: string;
  weekday: number; // 0 = Sunday … 6 = Saturday
  startMin: number; // minutes from midnight
  endMin: number;
};

/** A stylist's booking configuration. */
export type BookingSettings = {
  slotMinutes: number;
  acceptsBookings: boolean;
};

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

/** A booking between a client and a stylist, with the other party resolved. */
export type Booking = {
  id: string;
  stylistId: string;
  clientId: string;
  startsAt: string;
  durationMinutes: number;
  status: BookingStatus;
  note: string;
  cancelReason: string;
  /** What the stylist charged (0 when unset). Used for earnings. */
  price: number;
  createdAt: string;
  /** The viewer's role in this booking. */
  role: 'client' | 'stylist';
  /** The other participant (the stylist if you're the client, else the client). */
  other: UserSearchResult;
};

/** A computed bookable time slot for a given day. */
export type BookingSlot = {
  /** Absolute ISO start time. */
  iso: string;
  /** Local time label, e.g. "9:30 AM". */
  label: string;
  taken: boolean;
};

/** A comment on a post, with its author resolved for display. */
export type PostComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: UserSearchResult;
  /** Parent comment id when this is a reply, else null. */
  parentId: string | null;
};

export type ReminderUnit = 'day' | 'week' | 'month';

/** Ordinal position of a weekday within a month. -1 means "last". */
export type ReminderOrdinal = 1 | 2 | 3 | 4 | -1;

/**
 * How a cut reminder recurs:
 * - `interval`: every N days/weeks/months, anchored on a start date.
 * - `nth_weekday`: the Nth weekday of each month (e.g. first Monday).
 * - `one_off`: a single date, no repeat.
 */
export type ReminderRule =
  | { kind: 'interval'; every: number; unit: ReminderUnit; anchor: string }
  | { kind: 'nth_weekday'; ordinal: ReminderOrdinal; weekday: number }
  | { kind: 'one_off'; date: string };

export type CutReminder = {
  rule: ReminderRule;
  /** ISO timestamp the reminder was created/last edited. */
  createdAt: string;
};

export type Profile = {
  id: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string;
  instagram: string;
  website: string;
  currency: string;
  units: Units;
  /** @deprecated kept in sync with `privacy === 'public'` for compatibility. */
  profilePublic: boolean;
  privacy: Privacy;
  isStylist: boolean;
  notificationsEnabled: boolean;
  /** The user's configured "next cut" reminder, or null if none set. */
  cutReminder: CutReminder | null;
};

export type Stylist = {
  name: string;
  handle: string;
  avatarUrl: string;
  rating: number;
  totalCuts: number;
  specialties: string[];
  bio: string;
  verified: boolean;
};

export type Haircut = {
  id: string;
  /** ISO date string, e.g. "2026-05-01". */
  date: string;
  cutType: string;
  location: string;
  photos: Photo[];

  // Pricing
  price: number; // base price
  tip: number;

  // Social
  likes: number;
  comments: number;
  liked: boolean;
  bookmarked: boolean;

  // Specifications
  lengthTop: string;
  lengthSides: string;
  lengthBack: string;
  techniques: string[];
  tools: string[];

  // Notes
  publicNotes: string;
  privateNotes: string;
  stylistNotes: string;

  stylist: Stylist;
  /** Linked stylist account (a Sif user), if one was tagged. */
  stylistId: string | null;

  /** 'active' = a normal saved cut; 'pending' = submitted by a stylist, awaiting your acceptance. */
  status: 'active' | 'pending';
  /** User id of whoever entered this cut (you, or a stylist who created it for you). */
  createdBy: string;
};
