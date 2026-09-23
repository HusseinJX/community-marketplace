import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createMember, onboardFromMessages, researchListing, searchMatches } from "@/lib/api";
import { placeDetails, type PlaceDetails } from "@/lib/places";
import { isAdmin } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { MemberProfile } from "@/lib/types";

export const runtime = "nodejs";

// Create a real, UNCLAIMED business profile from a Google Places listing plus a
// web-researched story. The write half of the live canvass tool.
//
// ADMIN ONLY, unlike the lookup beside it. The /joindemo password unlocks a
// walkthrough and some read-only billable calls; this puts a row in the public
// directory that shoppers will see and a real business may later claim. A
// shared password is the wrong key for that door.
//
// The client sends a placeId and nothing else that ends up in the record: every
// fact is re-fetched here from Google, and the story is re-researched here. That
// is the same invariant the shop runs on — the server derives, the client never
// decides — and it matters more here, because a client-supplied "story" would
// be unattributed text written into a real business's public profile.

function profileFor(d: PlaceDetails): MemberProfile & { name: string } {
  const category = d.types[0]?.replace(/_/g, " ") ?? "Local business";
  return {
    name: d.name,
    businessName: d.name,
    memberType: "vendor",
    category,
    subcategory: category,
    city: d.city ?? undefined,
    neighborhood: d.neighborhood ?? undefined,
    latitude: d.lat ?? undefined,
    longitude: d.lng ?? undefined,
    placeId: d.placeId,
    googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(d.placeId)}`,
    businessAddress: d.address ?? undefined,
    businessPhone: d.phone ?? undefined,
    // NOT trustedPhone. That field is the ownership-verification anchor — the
    // number an OTP goes to when someone claims this page. Google's listing is
    // good enough to display and NOT good enough to prove ownership, and this
    // profile exists precisely so a stranger can come and claim it.
    websiteUrl: d.website ?? undefined,
    businessHours: d.hours ?? undefined,
    businessDescription: d.summary ?? undefined,
    notes: "Created from a Google Maps listing during live canvassing. Unclaimed.",
  };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json(
      { error: "admin_required", message: "Sign in as an admin to create profiles." },
      { status: 403 },
    );
  }

  const limited = rateLimit({
    req,
    name: "joindemo-create",
    id: userId,
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { placeId, force } = (await req.json().catch(() => ({}))) as {
    placeId?: string;
    force?: boolean;
  };
  if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 });

  const details = await placeDetails(placeId);
  if (!details) return NextResponse.json({ error: "place_not_found" }, { status: 404 });

  // Re-check for a duplicate at the moment of writing, not just at review time.
  // Two people canvassing the same street is exactly how a directory grows two
  // of everything. `force` is the operator overriding it on purpose.
  if (!force) {
    const want = details.name.trim().toLowerCase();
    const existing = await searchMatches(`${details.name} ${details.city ?? ""}`.trim(), 3)
      .then((m) =>
        m.find((c) => {
          const got = (c.name ?? "").trim().toLowerCase();
          return got === want || got.includes(want) || want.includes(got);
        }),
      )
      .catch(() => undefined);
    if (existing) {
      return NextResponse.json(
        { error: "duplicate", existing: { id: existing.id, name: existing.name } },
        { status: 409 },
      );
    }
  }

  const member = await createMember(profileFor(details), { source: "live_canvass" });
  const memberId = (member as { id: string }).id;

  // The story, written into the profile by the connector's own profiling brain
  // — the same engine the /join interview uses, so a canvassed page reads like
  // an onboarded one rather than a scrape.
  //
  // Best-effort and AFTER the member exists: the profile is already useful with
  // the Maps facts, and a failed research pass should leave a real page behind,
  // not a half-created one. Re-researched here rather than trusting the copy the
  // reviewer was shown.
  let story: string | null = null;
  try {
    const r = await researchListing(
      {
        name: details.name,
        city: details.city ?? details.neighborhood ?? null,
      },
      // Same leash as the lookup: the reviewer was just shown a story, and a
      // profile created without one because the default timed out would look
      // like the tool lied to them.
      { timeoutMs: 25_000 },
    );
    story = r.research;
    if (story) {
      await onboardFromMessages(
        [
          {
            role: "user",
            content: [
              `This is a real local business found on Google Maps during live canvassing.`,
              `Name: ${details.name}`,
              details.address ? `Address: ${details.address}` : "",
              details.city ? `City: ${details.city}` : "",
              details.website ? `Website: ${details.website}` : "",
              "",
              "Here is what a web search found about them:",
              story,
              "",
              "Write their profile from this. Do not invent anything the research does not support.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        { source: "live_canvass", memberId },
      );
    }
  } catch {
    /* the profile stands on the Maps facts; the story can be added later */
  }

  return NextResponse.json({
    memberId,
    name: details.name,
    storySaved: !!story,
    url: `/members/${memberId}`,
  });
}
