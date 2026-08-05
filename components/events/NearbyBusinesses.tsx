import { MemberCard } from "@/components/MemberCard";
import { fetchAllMembers } from "@/lib/landing";
import { milesTo, byDistance } from "@/lib/proximity";
import type { Member } from "@/lib/types";

// "While you're there" — the businesses closest to the event.
//
// Distances here are measured from the EVENT, not from the reader. Someone
// looking at a Saturday market three miles away wants to know what else is on
// that block when they get there, which is a fact about the venue and the same
// for everyone — so this renders on the server with no position lookup, no
// permission dialog, and nothing to wait for.
//
// The heading says "from the event" out loud, because the same green chip on
// the home directory means "from you" and the two must not be confused.

/** How far out still counts as "there". Beyond this it isn't the same trip. */
const MAX_MI = 5;
const LIMIT = 12;

/** People, not places you can walk into. */
const VISITABLE = new Set(["vendor", "artist", "organizer"]);

export async function NearbyBusinesses({
  lat,
  lng,
  excludeMemberId,
}: {
  lat: number;
  lng: number;
  /** The host — already named at the top of the page. */
  excludeMemberId?: string;
}) {
  let all: Member[] = [];
  try {
    // Cached for a day (lib/landing), so this costs a page nothing.
    all = await fetchAllMembers();
  } catch {
    return null; // directory unavailable — the page is fine without this
  }

  const near = all
    .filter((m) => {
      const p = m.profile;
      if (!p?.name || m.id === excludeMemberId) return false;
      return VISITABLE.has(String(p.memberType ?? "").toLowerCase());
    })
    // Measured once, then sorted — never a haversine inside a comparator.
    .map((m) => ({ m, miles: milesTo({ lat, lng }, m.profile) }))
    // Anything we couldn't place is dropped, not floated in at the end: this
    // section is a claim about proximity, and a business with no coordinates
    // has no business making it.
    .filter((d): d is { m: Member; miles: number } => d.miles != null && d.miles <= MAX_MI)
    .sort((a, b) => byDistance(a.miles, b.miles))
    .slice(0, LIMIT);

  if (near.length === 0) return null;

  return (
    <section className="mt-12 border-t border-stone-100 pt-8">
      <h2 className="text-xl font-semibold tracking-tight text-stone-900">
        Nearby businesses
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        Local spots closest to the venue — distances are from the event.
      </p>

      {/* A horizontal rail, matching the home directory. A grid of twelve
          cards below an event would bury the RSVP under a second page. */}
      <div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
        {near.map(({ m, miles }) => (
          <div key={m.id} className="w-60 shrink-0 sm:w-64">
            <MemberCard member={m} miles={miles} hasPosition />
          </div>
        ))}
      </div>
    </section>
  );
}
