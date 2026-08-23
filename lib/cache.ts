import { revalidateTag } from 'next/cache'
import { MEMBERS_TAG, memberTag } from './cache-tags'

// Re-exported so existing importers of '@/lib/cache' keep working.
export { MEMBERS_TAG, memberTag }

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

/**
 * Bust the cached copy of ONE member.
 *
 * getMember() is fetched with `revalidate: 300`, and for a long time it carried
 * no tag at all — so nothing could clear it. A vendor added a photo on
 * /vendor/about, the PATCH genuinely succeeded, and then the page read a copy
 * of the profile up to five minutes old and showed no photo. It looked like the
 * upload had failed, so they uploaded again; eventually the window expired and
 * one of the attempts appeared to "work". Every write that changes what a
 * member's own page shows has to call this, or the person making the edit is
 * the last to see it.
 *
 * Separate from invalidateMembers(), which clears the whole-directory snapshot:
 * a photo change matters to this member's page immediately, and to the
 * directory's ranking eventually.
 *
 * Fire-and-forget, same as invalidateMembers.
 */
export function invalidateMember(id: string): void {
  try {
    revalidateTag(memberTag(id), { expire: 0 })
  } catch {
    /* not in a revalidatable context — the 300s TTL still bounds staleness */
  }
}
