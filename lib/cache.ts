import { revalidateTag } from 'next/cache'

/** Cache tag for the whole-directory snapshot (lib/landing.ts fetchAllMembers). */
export const MEMBERS_TAG = 'members'

/**
 * Bust the cached directory snapshot.
 *
 * fetchAllMembers() is cached for 24h because the SEO pages (sitemap, /city,
 * /category) and directory SEARCH all walk it, and each walk reads the entire
 * member collection out of Firestore. But onboarding a business at an event and
 * then not finding it in search for a day would be a worse bug than the cost it
 * saves — so every path that creates or edits a member calls this, and the next
 * read rebuilds the snapshot immediately.
 *
 * Next 16 note: the one-arg revalidateTag(tag) is deprecated, and updateTag()
 * (the read-your-own-writes API) only works in Server Actions — these are Route
 * Handlers, so it's unavailable. We pass `{ expire: 0 }` rather than the
 * recommended 'max' profile on purpose: 'max' is stale-while-revalidate, which
 * would serve the PREVIOUS directory to the very next searcher — i.e. the
 * organizer who just onboarded a business at a booth wouldn't find it. Expiring
 * outright makes the next read a blocking refresh, which is what we want here
 * (it happens a handful of times a day, not per request).
 *
 * Fire-and-forget: never fail a write because cache invalidation hiccuped.
 */
export function invalidateMembers(): void {
  try {
    revalidateTag(MEMBERS_TAG, { expire: 0 })
  } catch {
    /* not in a revalidatable context — the 24h TTL still bounds staleness */
  }
}
