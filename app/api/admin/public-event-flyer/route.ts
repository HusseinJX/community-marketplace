import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { createMember, onboardFromMessages, searchMatches } from "@/lib/api";
import { invalidateMembers } from "@/lib/cache";
import { placeDetails, placesSearch, type PlaceDetails } from "@/lib/places";
import { hostIdFor } from "@/lib/sources/persist";
import type { Member, MemberProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_ID = "community_flyer";
const SOURCE_LABEL = "Community flyer";
const DEFAULT_REGION = "us";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and a Supabase key are required");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface EventDraft {
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  venue_name: string | null;
  venue_address: string | null;
  price: string | null;
  age_limit: string | null;
  ticket_url: string | null;
  instagram: string | null;
  phone: string | null;
  artists_or_vendors: string[];
  notes: string | null;
  raw_text: string | null;
  poster_image_url: string | null;
  venueResolution?: VenueResolution | null;
  useVenue?: boolean;
}

interface VenueResolution {
  flyerVenueName: string | null;
  flyerAddress: string | null;
  query: string | null;
  confidence: "none" | "low" | "medium" | "high";
  existingMemberId: string | null;
  candidate: {
    placeId: string;
    name: string;
    address: string | null;
    city: string | null;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    website: string | null;
    hours: string | null;
    summary: string | null;
    rating: number | null;
    userRatingsTotal: number | null;
    types: string[];
  } | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|inc|llc|co|company|restaurant|bar|cafe)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function eventFrom(value: unknown): EventDraft {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const artists = Array.isArray(raw.artists_or_vendors)
    ? raw.artists_or_vendors.map(String).map((v) => v.trim()).filter(Boolean)
    : [];

  return {
    title: str(raw.title) ?? "",
    description: str(raw.description),
    event_date: str(raw.event_date),
    event_time: str(raw.event_time),
    location: str(raw.location),
    venue_name: str(raw.venue_name),
    venue_address: str(raw.venue_address),
    price: str(raw.price),
    age_limit: str(raw.age_limit),
    ticket_url: str(raw.ticket_url),
    instagram: str(raw.instagram),
    phone: str(raw.phone),
    artists_or_vendors: artists,
    notes: str(raw.notes),
    raw_text: str(raw.raw_text),
    poster_image_url: str(raw.poster_image_url),
    venueResolution: (raw.venueResolution as VenueResolution | undefined) ?? null,
    useVenue: raw.useVenue === true,
  };
}

function buildDescription(event: EventDraft): string | null {
  const chunks: string[] = [];
  if (event.description) chunks.push(event.description);

  const details: string[] = [];
  if (event.venue_name) details.push(`Venue on flyer: ${event.venue_name}`);
  if (event.venue_address) details.push(`Address on flyer: ${event.venue_address}`);
  if (event.price) details.push(`Price: ${event.price}`);
  if (event.age_limit) details.push(`Age limit: ${event.age_limit}`);
  if (event.ticket_url) details.push(`Tickets: ${event.ticket_url}`);
  if (event.instagram) details.push(`Instagram: ${event.instagram}`);
  if (event.phone) details.push(`Phone: ${event.phone}`);
  if (event.artists_or_vendors.length) details.push(`Lineup/vendors: ${event.artists_or_vendors.join(", ")}`);
  if (event.notes) details.push(`Notes: ${event.notes}`);
  if (details.length) chunks.push(`Flyer details:\n${details.join("\n")}`);
  if (event.raw_text) chunks.push(`Full flyer text:\n${event.raw_text}`);

  return chunks.join("\n\n").trim() || null;
}

function venueQueryFor(event: EventDraft): string | null {
  const address = event.venue_address ?? event.location;
  if (event.venue_name && address) return `${event.venue_name} ${address}`;
  return event.venue_name ?? address ?? null;
}

function confidenceFor(event: EventDraft, details: PlaceDetails): VenueResolution["confidence"] {
  const flyerName = normalized(event.venue_name);
  const mapsName = normalized(details.name);
  const flyerAddress = normalized(event.venue_address ?? event.location);
  const mapsAddress = normalized(details.address);

  if (flyerName && mapsName && (flyerName === mapsName || flyerName.includes(mapsName) || mapsName.includes(flyerName))) {
    return flyerAddress && mapsAddress && mapsAddress.includes(flyerAddress.split(" ").slice(0, 3).join(" "))
      ? "high"
      : "medium";
  }
  if (event.venue_address && details.address) return "medium";
  return "low";
}

async function findExistingMember(details: PlaceDetails): Promise<string | null> {
  const candidates = await searchMatches(`${details.name} ${details.address ?? ""}`, 8).catch(() => []);
  for (const candidate of candidates) {
    const profile = (candidate.profile ?? {}) as MemberProfile;
    if (profile.placeId && profile.placeId === details.placeId) return candidate.id;

    const nameMatches = normalized(profile.name ?? profile.businessName) === normalized(details.name);
    const addressMatches =
      normalized(profile.businessAddress).length > 0 &&
      normalized(details.address).includes(normalized(profile.businessAddress).split(" ").slice(0, 4).join(" "));
    const profileLat = typeof profile.latitude === "number" ? profile.latitude : null;
    const profileLng = typeof profile.longitude === "number" ? profile.longitude : null;
    const nearby =
      profileLat !== null &&
      profileLng !== null &&
      details.lat !== null &&
      details.lng !== null &&
      distanceMeters({ lat: profileLat, lng: profileLng }, { lat: details.lat, lng: details.lng }) < 75;

    if (nameMatches && (addressMatches || nearby)) return candidate.id;
  }
  return null;
}

function publicDetails(details: PlaceDetails): VenueResolution["candidate"] {
  return {
    placeId: details.placeId,
    name: details.name,
    address: details.address,
    city: details.city,
    neighborhood: details.neighborhood,
    lat: details.lat,
    lng: details.lng,
    phone: details.phone,
    website: details.website,
    hours: details.hours,
    summary: details.summary,
    rating: details.rating,
    userRatingsTotal: details.userRatingsTotal,
    types: details.types,
  };
}

async function resolveVenue(event: EventDraft): Promise<VenueResolution> {
  const query = venueQueryFor(event);
  if (!query || query.length < 3) {
    return {
      flyerVenueName: event.venue_name,
      flyerAddress: event.venue_address,
      query,
      confidence: "none",
      existingMemberId: null,
      candidate: null,
    };
  }

  const [candidate] = await placesSearch(query, { limit: 1, region: DEFAULT_REGION });
  if (!candidate?.placeId) {
    return {
      flyerVenueName: event.venue_name,
      flyerAddress: event.venue_address,
      query,
      confidence: "none",
      existingMemberId: null,
      candidate: null,
    };
  }

  const details = await placeDetails(candidate.placeId);
  if (!details) {
    return {
      flyerVenueName: event.venue_name,
      flyerAddress: event.venue_address,
      query,
      confidence: "none",
      existingMemberId: null,
      candidate: null,
    };
  }

  const existingMemberId = await findExistingMember(details);
  return {
    flyerVenueName: event.venue_name,
    flyerAddress: event.venue_address,
    query,
    confidence: confidenceFor(event, details),
    existingMemberId,
    candidate: publicDetails(details),
  };
}

function profileFor(details: NonNullable<VenueResolution["candidate"]>, event: EventDraft): MemberProfile & { name: string } {
  const category = details.types[0]?.replace(/_/g, " ") ?? "Venue";
  return {
    name: details.name || event.venue_name || event.title,
    businessName: details.name || event.venue_name || event.title,
    memberType: "vendor",
    category,
    subcategory: category,
    city: details.city ?? undefined,
    neighborhood: details.neighborhood ?? undefined,
    latitude: details.lat ?? undefined,
    longitude: details.lng ?? undefined,
    placeId: details.placeId,
    googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(details.placeId)}`,
    businessAddress: details.address ?? undefined,
    businessPhone: details.phone ?? event.phone ?? undefined,
    trustedPhone: details.phone ?? event.phone ?? undefined,
    websiteUrl: details.website ?? undefined,
    businessHours: details.hours ?? undefined,
    businessDescription:
      details.summary ??
      `Local venue found from a public event flyer. ${event.title} was listed here.`,
    notes: `Created from public event flyer import for "${event.title}".`,
  };
}

async function ensureVenue(event: EventDraft): Promise<{ memberId: string; memberName: string; created: boolean; venue: NonNullable<VenueResolution["candidate"]> } | null> {
  const resolution = event.venueResolution;
  const venue = resolution?.candidate;
  if (!event.useVenue || !venue || resolution.confidence === "none") return null;
  if (resolution.existingMemberId) {
    return { memberId: resolution.existingMemberId, memberName: venue.name, created: false, venue };
  }

  const member = await createMember(profileFor(venue, event), { source: "community_flyer" });
  const created = member as Member;
  const memberId = created.id;

  try {
    await onboardFromMessages(
      [
        {
          role: "user",
          content: [
            `Create a concise, accurate local business profile/story for ${venue.name}.`,
            venue.address ? `Google Maps address: ${venue.address}` : null,
            venue.website ? `Website: ${venue.website}` : null,
            venue.summary ? `Google summary: ${venue.summary}` : null,
            `It was discovered from a public flyer for: ${event.title}.`,
            event.raw_text ? `Flyer text: ${event.raw_text}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { memberId, source: "community_flyer_enrichment" },
    );
  } catch {
    // Best-effort; the Maps-backed profile and event should still be created.
  }

  invalidateMembers();
  return { memberId, memberName: venue.name, created: true, venue };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; events?: unknown };
  const action = body.action === "resolve" ? "resolve" : "publish";
  const items: unknown[] = Array.isArray(body.events) ? body.events : [];
  const events = items
    .map(eventFrom)
    .filter((event) => event.title);

  if (!events.length) {
    return NextResponse.json({ error: action === "resolve" ? "No event drafts to resolve" : "No event drafts to publish" }, { status: 400 });
  }

  if (action === "resolve") {
    const resolved = await Promise.all(
      events.map(async (event) => ({
        ...event,
        venueResolution: await resolveVenue(event),
      })),
    );
    return NextResponse.json({ events: resolved });
  }

  const reviewedAt = new Date().toISOString();
  const rows = [];
  const createdVenues = [];
  for (const event of events) {
    const ensured = await ensureVenue(event);
    if (ensured?.created) createdVenues.push({ id: ensured.memberId, name: ensured.memberName });

    const venue = ensured?.venue ?? event.venueResolution?.candidate ?? null;
    const memberId = ensured?.memberId ?? hostIdFor(SOURCE_ID);
    const memberName = ensured?.memberName ?? SOURCE_LABEL;
    const description = buildDescription(event);

    rows.push({
      member_id: memberId,
      member_name: memberName,
      title: event.title,
      description,
      event_date: event.event_date || null,
      event_time: event.event_time || null,
      location: event.location || event.venue_address || venue?.address || null,
      city: venue?.city ?? null,
      neighborhood: venue?.neighborhood ?? null,
      lat: venue?.lat ?? null,
      lng: venue?.lng ?? null,
      poster_image_url: event.poster_image_url || null,
      source: SOURCE_ID,
      active: true,
      source_id: SOURCE_ID,
      external_uid: `flyer:${randomUUID()}`,
      event_url: event.ticket_url || null,
      reviewed_at: reviewedAt,
    });
  }

  const { data, error } = await db()
    .from("vendor_events")
    .insert(rows)
    .select("id, title");

  if (error) {
    return NextResponse.json({ error: error.message || "Could not publish events" }, { status: 500 });
  }

  return NextResponse.json({ created: data ?? [], createdVenues });
}
