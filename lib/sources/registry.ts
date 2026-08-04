// The watched sources.
//
// This file is the hand-curated list — every entry is a deliberate editorial
// choice about what belongs in the community feed, not the output of crawling
// the open web. When this moves into Supabase (`event_sources`), these become
// rows; the shape is already the row shape.
//
// All verified live on 2026-08-02. See scraping.md for how each was found.
//
// ⚠️ ADDING A SOURCE? Add its poster-image hostname to `images.remotePatterns`
// in next.config.ts at the same time. next/image rejects any host not listed:
// it throws in dev, and in production every image request 400s — which is how
// a whole feed of harvested events once shipped with broken posters.

import type { SourceDef } from './types'

export const SOURCES: SourceDef[] = [
  // ── Library ────────────────────────────────────────────────────────────────
  {
    id: 'sfpl',
    label: 'San Francisco Public Library',
    site: 'https://sfpl.org',
    pattern: 'drupal-ics',
    category: 'library',
    config: { base: 'https://sfpl.org', listPath: '/events', icsPath: '/sfpl-events/add-to-calendar', perPage: 50, maxPages: 8, utcOffsetHours: -7 },
    windowDays: 14,
    // Storytimes are ~29% of SFPL's volume — 63 of 258 in a sample week —
    // repeating weekly across 29 branches with identical titles and no
    // description. Excellent library service, unusable feed content.
    // The rule is a tag match in the source's own vocabulary, not a guess.
    excludeTags: ['Storytime'],
    excludeTitle: [/^storytime\b/i, /^FULL:/i],
    // Branch labels alone ('Excelsior') geocode to the wrong city; the template
    // turns them into a real library address. Main is the fallback pin.
    venueTemplate: '{venue} Branch Library, San Francisco, CA',
    venueAliases: {
      Main: 'San Francisco Main Public Library, 100 Larkin St, San Francisco, CA',
      Mission: 'Mission Branch Library, 300 Bartlett St, San Francisco, CA',
      Park: 'Park Branch Library, 1833 Page St, San Francisco, CA',
    },
    defaultLatLng: { lat: 37.7786, lng: -122.4159 }, // Main Library, 100 Larkin
    expectAtLeast: 240, // observed 400 on 2026-08-02
  },

  // ── Aggregator ─────────────────────────────────────────────────────────────
  {
    id: 'funcheap',
    label: 'Funcheap SF',
    site: 'https://sf.funcheap.com',
    pattern: 'json-ld',
    category: 'aggregator',
    // Human-curated FREE events — the closest thing to a mission-aligned
    // firehose in SF. No feed, but every event page carries JSON-LD Event and
    // the site exposes /YYYY/MM/DD/ date archives (~24 links each).
    config: { base: 'https://sf.funcheap.com', mode: 'archive', maxEvents: 220, browserUa: true },
    windowDays: 7,
    expectAtLeast: 105, // observed 175 on 2026-08-02
  },

  // ── Arts & culture ─────────────────────────────────────────────────────────
  {
    id: 'fortmason',
    label: 'Fort Mason Center',
    site: 'https://fortmason.org',
    pattern: 'wp-tribe',
    category: 'arts',
    // 1,663 events in the catalog — larger than SFPL's entire forward window.
    config: { base: 'https://fortmason.org', perPage: 50, maxPages: 6 },
    windowDays: 45,
    // 162 of its events carry no venue at all — but it is one campus.
    defaultLatLng: { lat: 37.8065, lng: -122.4310 }, // 2 Marina Blvd
    expectAtLeast: 98, // observed 164 on 2026-08-02
  },
  {
    id: 'ybgfestival',
    label: 'Yerba Buena Gardens Festival',
    site: 'https://ybgfestival.org',
    pattern: 'wp-tribe',
    category: 'arts',
    config: { base: 'https://ybgfestival.org', perPage: 50, maxPages: 2 },
    windowDays: 90,
    // The plugin's own geo is junk here (geo_lat: 37, geo_lng: 122 —
    // integer-truncated and sign-flipped), so we ignore it and pin the gardens.
    defaultLatLng: { lat: 37.7847, lng: -122.4028 }, // Yerba Buena Gardens
    expectAtLeast: 17, // observed 29 on 2026-08-02
  },
  {
    id: 'gggp',
    label: 'Gardens of Golden Gate Park',
    site: 'https://gggp.org',
    pattern: 'wp-tribe',
    category: 'parks',
    // sfbg.org and gggp.org are the SAME site (Botanical Garden, Conservatory
    // of Flowers and Japanese Tea Garden share one calendar) — one source, not
    // two, or every event would be imported twice.
    config: { base: 'https://gggp.org', perPage: 50, maxPages: 3 },
    windowDays: 60,
    defaultLatLng: { lat: 37.7702, lng: -122.4685 }, // SF Botanical Garden
    expectAtLeast: 30, // observed 50 on 2026-08-02
  },
  {
    id: 'tiat',
    label: 'TIAT — The Intersection of Art & Technology',
    site: 'https://www.tiat.place',
    pattern: 'luma',
    category: 'arts',
    // Calendar id found in a luma embed on tiat.place.
    config: { calendarId: 'cal-twiOosdGMMY66DI', timezone: 'America/Los_Angeles', pageLimit: 50 },
    windowDays: 90,
    defaultLatLng: { lat: 37.7857, lng: -122.4080 }, // 151 Powell St
    expectAtLeast: 10, // observed 18 on 2026-08-02
  },
  {
    id: 'somarts',
    label: 'SOMArts Cultural Center',
    site: 'https://somarts.org',
    pattern: 'json-ld',
    category: 'arts',
    config: { base: 'https://somarts.org', mode: 'listing', path: '/events' },
    windowDays: 90,
    defaultLatLng: { lat: 37.7726, lng: -122.4130 }, // 934 Brannan St
    expectAtLeast: 1, // observed 3 on 2026-08-02
  },

  // ── Neighbourhood / business district ──────────────────────────────────────
  {
    id: 'downtownsf',
    label: 'Downtown SF',
    site: 'https://downtownsf.org',
    pattern: 'recipe',
    category: 'bid',
    config: { base: 'https://downtownsf.org', listPath: '/things-to-do/events', detailPrefix: '/do/' },
    windowDays: 30,
    venueTemplate: '{venue}, Downtown San Francisco, CA',
    defaultLatLng: { lat: 37.7898, lng: -122.4014 }, // district centroid
    expectAtLeast: 24, // observed 41 on 2026-08-02
  },

  // ── Community / food ───────────────────────────────────────────────────────
  {
    id: 'lacocina',
    label: 'La Cocina',
    site: 'https://www.lacocinasf.org',
    pattern: 'squarespace',
    category: 'community',
    config: { base: 'https://www.lacocinasf.org', collection: '/events', timezone: 'America/Los_Angeles' },
    windowDays: 180,
    defaultLatLng: { lat: 37.7817, lng: -122.4160 }, // La Cocina Municipal Marketplace
    expectAtLeast: 1, // observed 3 on 2026-08-02
  },

  // ── Education ──────────────────────────────────────────────────────────────
  {
    id: 'ucsf',
    label: 'UCSF',
    site: 'https://calendar.ucsf.edu',
    pattern: 'localist',
    category: 'civic',
    config: { base: 'https://calendar.ucsf.edu', perPage: 100, maxPages: 2 },
    windowDays: 30,
    limit: 120,
    // UCSF's calendar carries events well outside SF (Olympic Valley, etc.).
    // No default pin: the bbox check should drop those, not relocate them.
    expectAtLeast: 69, // observed 115 on 2026-08-02
  },
]

export const byId = (id: string) => SOURCES.find((s) => s.id === id)
