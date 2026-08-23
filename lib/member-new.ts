import type { Member, FirestoreTimestamp } from "@/lib/types";

/**
 * How long a business counts as newly added.
 *
 * Long enough that someone who adds a business on a Friday still finds it
 * out front the following week, short enough that "new" keeps meaning
 * something — a shelf where a third of the tiles are badged new is a shelf
 * with no new tiles on it.
 */
export const NEW_MEMBER_DAYS = 14;

const DAY_MS = 86_400_000;

/** Firestore hands back {_seconds}; the prolocaliq import wrote ISO strings. */
function toMs(t: Member["createdAt"]): number | null {
  if (!t) return null;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }
  const secs = (t as FirestoreTimestamp)._seconds;
  return typeof secs === "number" ? secs * 1000 : null;
}

/**
 * When this business joined, as well as we can know it.
 *
 * `createdAt` when it exists — but on the live directory it only does for the
 * 87 bulk-imported rows. Every member created since (canvassing-map, app) has
 * NO createdAt, because the connector only stamps it on one create path. So
 * keying on it alone made "Recently joined" precisely empty of the businesses
 * it exists to show.
 *
 * `lastActiveAt` is the fallback, and it is a proxy with a known flaw: it is
 * bumped by profile edits and re-embeds, so editing an old canvassed listing
 * can float it back into the rail. Accepted deliberately — it only applies to
 * rows with no createdAt, the window is short, and a business that was just
 * edited is at least a defensible thing to show under "recently joined". The
 * real fix is upstream: stamp createdAt on every member create in the
 * connector, and this fallback stops being reachable for anything new.
 */
export function memberAddedAt(m: Member): number | null {
  return toMs(m.createdAt) ?? toMs(m.lastActiveAt) ?? null;
}

/** Added within the window — see memberAddedAt for which timestamp that is. */
export function isNewMember(m: Member, now = Date.now()): boolean {
  const added = memberAddedAt(m);
  return added !== null && now - added < NEW_MEMBER_DAYS * DAY_MS;
}

/**
 * Newly added businesses first, newest of those first; everything else keeps
 * the order it arrived in.
 *
 * The incoming order is the distance ranking, and this is the ONE place that
 * is allowed to override it. The reason is that distance is a good answer to
 * "what is near me" and a bad answer to "did the thing I just added work" —
 * a business added today can sort forty tiles deep in its own category and
 * read, to the person who added it, as not having been added at all.
 *
 * Stable on both sides of the split, so within the new group and within the
 * rest, distance still decides.
 */
export function newestFirst<T extends Member>(members: T[], now = Date.now()): T[] {
  const fresh: { m: T; added: number }[] = [];
  const rest: T[] = [];
  for (const m of members) {
    const added = memberAddedAt(m);
    if (added !== null && now - added < NEW_MEMBER_DAYS * DAY_MS) fresh.push({ m, added });
    else rest.push(m);
  }
  if (!fresh.length) return members;
  fresh.sort((a, b) => b.added - a.added);
  return [...fresh.map((f) => f.m), ...rest];
}
