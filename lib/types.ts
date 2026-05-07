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
  businessName?: string;
  website?: string;
  description?: string;
  enrichedAt?: string;
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
