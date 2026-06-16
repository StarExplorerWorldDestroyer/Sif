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
};

/** A public-facing profile shown on shareable pages (no private fields). */
export type PublicProfile = {
  id: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string;
  privacy?: Privacy;
  isStylist?: boolean;
};

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

/** A public post shown on shareable pages, joined with its author. */
export type PublicPost = {
  id: string;
  caption: string;
  photoUrl: string;
  cutType: string;
  createdAt: string;
  author: PublicProfile;
};

export type Profile = {
  id: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string;
  currency: string;
  units: Units;
  /** @deprecated kept in sync with `privacy === 'public'` for compatibility. */
  profilePublic: boolean;
  privacy: Privacy;
  isStylist: boolean;
  notificationsEnabled: boolean;
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

  /** 'active' = a normal saved cut; 'pending' = submitted by a stylist, awaiting your acceptance. */
  status: 'active' | 'pending';
  /** User id of whoever entered this cut (you, or a stylist who created it for you). */
  createdBy: string;
};
