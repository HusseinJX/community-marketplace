import { MemberCard } from "@/components/MemberCard";
import { fetchAllMembers } from "@/lib/landing";
import { groupMembers } from "@/lib/browse-groups";
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
/** The lead rail: the closest handful, whatever they are. */
const LIMIT = 8;
/** Per category rail. */
const PER_GROUP = 12;

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
    .sort((a, b) => byDistance(a.miles, b.miles));

  if (near.length === 0) return null;

  const milesById = new Map(near.map((d) => [d.m.id, d.miles]));

  // Same category rails as the Shop tab, scoped to what is walkable from this
  // venue. The lead rail answers "what is right here"; these answer "what kind
  // of thing am I after" — which is the question someone actually has once
  // they've decided to come. Each stays in distance order within its category.
  const groups = groupMembers(near.map((d) => d.m))
    .map((g) => ({ ...g, members: g.members.slice(0, PER_GROUP) }))
    .filter((g) => g.members.length > 0);

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
      <Rail members={near.slice(0, LIMIT).map((d) => d.m)} milesById={milesById} />

      <div className="mt-8 space-y-7">
        {groups.map(({ group, members }) => (
          <div key={group.key}>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
              <span className="text-xl leading-none">{group.emoji}</span>
              {group.label}
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                {members.length}
              </span>
            </h3>
            <Rail members={members} milesById={milesById} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Rail({
  members,
  milesById,
}: {
  members: Member[];
  milesById: Map<string, number>;
}) {
  return (
    <div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
      {members.map((m) => (
        <div key={m.id} className="w-44 shrink-0 sm:w-52">
          <MemberCard member={m} miles={milesById.get(m.id) ?? null} hasPosition />
        </div>
      ))}
    </div>
  );
}
