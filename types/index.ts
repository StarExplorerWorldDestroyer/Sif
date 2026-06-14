/** Shared data types for the Haircuts app. */

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
  photoUrl: string;

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
};
