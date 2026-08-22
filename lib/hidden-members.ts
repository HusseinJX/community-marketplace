// Members kept out of every PUBLIC surface — the directory, /explore, the
// category/city landing pages, the sitemap, name search, and the events feed —
// without deleting anything.
//
// A hidden member is still fully alive: reachable by direct id via getMember(),
// still able to sign in, still able to run their own vendor portal. This list
// only answers "should strangers browsing the app be shown this?".
//
// It is a curation exception, not a general mechanism. Two kinds of entry
// qualify: accounts that exist for a purpose other than being found (the App
// Store reviewer's demo vendor), and our own listings, which would otherwise
// sit in the directory competing with the local businesses the directory is
// for. Anything else — a business we simply don't want to show — is a
// moderation decision and belongs in lib/moderation.ts, not here.
//
// Readers: lib/api.ts (listMembers → directory, explore, landing, sitemap) and
// lib/vendor-connect.ts (getPublicEvents / getMemberEvents → the events feed),
// plus the For-you feed's own query in app/api/events/personalize.
//
// ── ONE DELIBERATE EXCEPTION: the shop (2026-08-22) ────────────────────────
// The marketplace does NOT filter on this list. A hidden member's PRODUCTS are
// listed and their product pages resolve.
//
// The rule above is about a LISTING — being one of the local businesses a
// stranger browses. A product is not a listing; it is a thing for sale, and a
// storefront that hides real stock while it has almost none is not curating,
// it is empty. The two reasons for hiding a member both survive it: the
// reviewer's demo vendor has no products, and our own listing still stays out
// of the directory it would otherwise compete in.
//
// So this is not an oversight to tidy up. If you are here because the shop
// shows Xeno and the directory does not, that is the intended state.
export const HIDDEN_MEMBER_IDS: readonly string[] = [
  "03e75c7c-28bf-44ee-ab0d-82379a4f75cd", // WhatsLocal Review (Demo Vendor) — exists for App Review
  "89516919-256f-4a95-96df-fc9d285f664a", // Xeno — our own founder profile
];

const HIDDEN = new Set<string>(HIDDEN_MEMBER_IDS);

export function isHiddenMember(id: string | null | undefined): boolean {
  return !!id && HIDDEN.has(id);
}

/** Drop hidden members from any list of things carrying a member id. */
export function withoutHiddenMembers<T>(rows: T[], idOf: (row: T) => string | null | undefined): T[] {
  return rows.filter((r) => !isHiddenMember(idOf(r)));
}

/**
 * The same list as a PostgREST `in` value, for `.not('member_id', 'in', …)`.
 *
 * Safe unquoted because these are UUIDs, and safe as a NOT IN because
 * `vendor_events.member_id` is NOT NULL — on a nullable column this would also
 * silently drop every row with no member, since NULL NOT IN (…) is NULL.
 */
export const HIDDEN_MEMBER_IN_LIST = `(${HIDDEN_MEMBER_IDS.join(",")})`;
