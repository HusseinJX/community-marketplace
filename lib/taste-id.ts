// This browser's own id for its saved taste profile.
//
// Most shoppers never sign in, and a personalised feed that only existed for
// people with an account would be a feature almost nobody got. So the profile
// is keyed on a random id this browser mints for itself; signing in later moves
// the same person onto their Clerk id, which the server prefers from then on.
//
// Deliberately opaque and random — it identifies a browser, not a person, and
// carries nothing about them.

const KEY = 'wl_taste_id'

/**
 * Read the id, minting one on first use.
 *
 * Returns null during SSR and whenever storage is unavailable (private mode,
 * blocked cookies). Callers must treat null as "no saved profile" rather than
 * as an error — the feed works perfectly well without one, exactly as it did
 * before this existed.
 */
export function tasteId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const found = window.localStorage.getItem(KEY)
    if (found) return found
    // `device:` is the shape the server validates before it will use the value
    // as a database key, so nothing here can be passed off as a Clerk id.
    const minted = `device:${crypto.randomUUID().replace(/-/g, '')}`
    window.localStorage.setItem(KEY, minted)
    return minted
  } catch {
    return null
  }
}
