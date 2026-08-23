// Cache TAG NAMES only — no next/cache import.
//
// Kept separate from lib/cache.ts because that module imports `revalidateTag`,
// which is only legal in a Server Component / Route Handler. lib/api.ts needs
// the tag names to ATTACH them to its fetches, and api.ts is reachable from
// contexts where importing next/cache is a build error. Names here, the
// invalidation that uses them there.

/** The whole-directory snapshot (lib/landing.ts fetchAllMembers). */
export const MEMBERS_TAG = 'members'

/** One member's own record (lib/api.ts getMember). */
export const memberTag = (id: string) => `member:${id}`
