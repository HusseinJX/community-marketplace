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
  /** Admin-set "trusted" onboarding number: only a call/text from this number
   *  may onboard/claim this profile (possession gate in the connector). */
  trustedPhone?: string;
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
  // hero imagery
  imageUrl?: string;
  images?: string[];
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
  // who a community org primarily serves — drives vendor- vs shopper-facing
  // filtering. Values from ORG_SERVES in lib/org-focus.ts.
  serves?: string[];
  // organizer sub-type: "public-events" (festivals/large gatherings) vs
  // "community-service" (mutual aid/nonprofits). See ORG_FOCUS in lib/org-focus.ts.
  organizerFocus?: string;
  // business facets (lib/business-facets.ts): size + ownership/type tags
  businessSize?: string;
  ownershipTags?: string[];
  [key: string]: unknown;
}

export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

export interface Member {
  id: string;
  profile?: MemberProfile;
  source?: "web" | "sms" | "google_places_harvest";
  status?: "unclaimed" | "claimed";
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

export interface SearchIntent {
  semantic?: string;
  filters?: Record<string, unknown>;
  excludes?: Record<string, unknown>;
  intent?: "find" | "vibe" | "compare" | "recommend";
}

export interface SearchResultMember extends Member {
  matchedOn?: string[];
  score?: number;
}

export interface SearchResponse {
  intent: SearchIntent;
  results: SearchResultMember[];
}

// Normalized match candidate — one shape the UI can render regardless of which
// connector matching endpoint produced it (semantic search, similar-members,
// complementary, or convener lineup fill). See lib/api.ts match helpers.
export interface MatchCandidate {
  id: string;
  name: string;
  memberType?: string;
  city?: string;
  neighborhood?: string;
  category?: string;
  score?: number; // 0..1 relevance/similarity
  reasons: string[]; // matchedOn / fit breadcrumbs shown as chips
  offers?: string[];
  role?: string; // which lineup role this candidate fills (lineup mode only)
  profile?: MemberProfile; // present when the endpoint returns a full profile
}

// An AI-proposed event lineup (convener invent-event) — a draft event plus, for
// each role it needs, a ranked list of members who could fill it.
export interface LineupSuggestion {
  title: string;
  description: string;
  roles: { role: string; type?: string; candidates: MatchCandidate[] }[];
}
