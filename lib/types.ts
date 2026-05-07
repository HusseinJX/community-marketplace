export type MemberType =
  | "vendor"
  | "shopper"
  | "artist"
  | "organizer"
  | "influencer";

export interface MemberProfile {
  name?: string;
  memberType?: MemberType;
  city?: string;
  neighborhood?: string;
  vibe?: string;
  notes?: string;
  personalNote?: string;
  approvedBlurb?: string;
  interests?: string[];
  goals?: string[];
  painPoints?: string[];
  dislikes?: string[];
  dietaryRestrictions?: string[];
  eventPostingPlatforms?: string[];
  category?: string;
  subcategory?: string;
  // location
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  // enriched business fields
  businessName?: string;
  businessCategory?: string;
  businessType?: string;
  businessDescription?: string;
  businessHours?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  twitterHandle?: string;
  xHandle?: string;
  threadsHandle?: string;
  youtubeUrl?: string;
  youtubeHandle?: string;
  linkedinUrl?: string;
  spotifyUrl?: string;
  soundcloudUrl?: string;
  facebookUrl?: string;
  eventbriteUrl?: string;
  bandsintownUrl?: string;
  songkickUrl?: string;
  meetupUrl?: string;
  pinterestUrl?: string;
  services?: string[];
  specialties?: string[];
  menuHighlights?: string[];
  products?: string[];
  priceRange?: string;
  featuredProduct?: string;
  shopUrl?: string;
  etsyUrl?: string;
  shopifyUrl?: string;
  shareTypes?: string[];
  reviewsSummary?: string;
  enrichedAt?: string;
  // artist fields
  discipline?: string;
  venueTypes?: string[];
  yearsExperience?: string;
  // organizer fields
  cause?: string;
  needsMost?: string[];
  connectWith?: string[];
  [key: string]: unknown;
}

export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

export interface Member {
  id: string;
  profile?: MemberProfile;
  source?: "web" | "sms";
  lastActiveAt?: FirestoreTimestamp | string | null;
}

export interface EventSuggestion {
  id: string;
  memberId: string;
  memberName?: string;
  source?: { platform?: string; url?: string };
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  originalExcerpt?: string;
  reworded?: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: FirestoreTimestamp | string | null;
  updatedAt?: FirestoreTimestamp | string | null;
}

export interface MembersResponse {
  members: Member[];
  total: number;
}

export interface MemberResponse {
  member: Member;
}

export interface EventsResponse {
  events: EventSuggestion[];
}
