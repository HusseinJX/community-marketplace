// Event sourcing — shared types.
//
// One `ScrapedEvent` shape for every adapter, so downstream code (dedupe,
// filtering, draft insertion) never cares which platform an event came from.
// See scraping.md for the architecture and the per-source field notes.

export type Pattern =
  | 'wp-tribe' // WordPress + The Events Calendar (JSON API + ICS export)
  | 'squarespace' // any Squarespace collection: ?format=json
  | 'luma' // Luma calendar JSON API
  | 'drupal-ics' // Drupal listing → per-event .ics (SFPL)
  | 'json-ld' // schema.org Event on the event page (Funcheap, and the generic fallback)
  | 'localist' // Localist JSON API (universities and large institutions)
  | 'recipe' // hand-written selectors for a site with no feed (Downtown SF)

/** Public-ness of an event. `unknown` means the source gave no signal. */
export type Access = 'public' | 'private' | 'unknown'

export interface ScrapedEvent {
  /** Stable id from the source (ICS UID, API id, slug). Primary dedupe key. */
  uid: string
  sourceId: string
  sourceLabel: string
  title: string
  /** ISO `YYYY-MM-DD`, local to the event. */
  date: string
  /** ISO `YYYY-MM-DD` when the event runs over multiple days (exhibitions). */
  endDate: string | null
  /** `HH:MM` 24h local, or null for all-day. */
  start: string | null
  end: string | null
  venue: string | null
  location: string | null
  description: string | null
  url: string
  imageUrl: string | null
  access: Access
  tags: string[]
  /** True when the source told us it is free. Null = not stated. */
  free: boolean | null
  /** Map pin. Null when we could not place it — never guessed. */
  lat: number | null
  lng: number | null
  /** How the pin was obtained, so a bad batch can be invalidated selectively. */
  geoVia: 'native' | 'source' | 'nominatim' | 'google' | null
  /** Neighbourhood, when the source states one (Luma does). */
  neighborhood: string | null
}

export interface SourceDef {
  id: string
  label: string
  /**
   * Which city this source feeds, as a `PLACES` id ('sf', 'oak', …).
   *
   * This is what ACTIVATES a city. A city is live when at least one enabled
   * source points at it (see lib/cities.ts) — the city header, and anything
   * else that asks "are we in this city yet", derives from these, never from a
   * hand-typed flag. Adding the first Oakland source turns Oakland on.
   */
  city: string
  /**
   * Off switch. Absent or true = running. Set `false` to stop scraping a source
   * without deleting its recipe — and note that turning off the LAST source in
   * a city turns that city off, because live-ness is derived from these.
   */
  enabled?: boolean
  /** Homepage — what a person would paste. */
  site: string
  pattern: Pattern
  /** Pattern-specific config: base URL, calendar id, collection path, etc. */
  config: Record<string, string | number | boolean>
  category: 'library' | 'arts' | 'museum' | 'parks' | 'community' | 'food' | 'music' | 'bid' | 'aggregator' | 'civic'
  /** Drop events whose title matches any of these (case-insensitive). */
  excludeTitle?: RegExp[]
  /** Drop events carrying any of these tags (case-insensitive, prefix match). */
  excludeTags?: string[]
  /** How far ahead to scrape, in days. Sources have very different horizons. */
  windowDays?: number
  /** Cap on events kept per run — a guard against a source dwarfing the feed. */
  limit?: number
  /**
   * Fallback pin for single-site sources. Fort Mason publishes 162 events with
   * no venue field at all, but they are all on one campus — so the source's own
   * location is the correct answer, not a missing one.
   */
  defaultLatLng?: { lat: number; lng: number }
  /**
   * Geocoder template for sources whose venue field is a bare label. SFPL says
   * "Excelsior", which alone geocodes to a street in Oakland; the template turns
   * it into "Excelsior Branch Library, San Francisco, CA".
   */
  venueTemplate?: string
  /**
   * Exact geocoder strings for venue labels the template gets wrong. SFPL's
   * flagship is listed as "Main", and "Main Branch Library" is not a real
   * place — it needs its actual address.
   */
  venueAliases?: Record<string, string>
  /**
   * Drift detection. A source that suddenly returns far fewer events than usual
   * has probably changed its markup — and "0 events" looks exactly like "a quiet
   * week" unless something declares what normal is.
   *
   * Set from an observed baseline, generously low. Violations FAIL the run
   * rather than quietly shrinking the feed.
   */
  expectAtLeast?: number
}

export interface RunReport {
  sourceId: string
  label: string
  pattern: Pattern
  ok: boolean
  /** Raw count the adapter produced, before filtering. */
  pulled: number
  /** Kept after exclusions, past-date drops and dedupe. */
  kept: number
  excluded: number
  seconds: number
  requests: number
  error?: string
  /** Set when the source returned fewer events than its declared baseline. */
  belowBaseline?: { expected: number; got: number }
}
