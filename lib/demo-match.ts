import type { MatchCandidate } from '@/lib/types'
import type { Opportunity } from '@/app/api/vendor/opportunities/route'

// Canned matches for the Admin demo.
//
// The demo entry is a self-serve COOKIE — any visitor can set it by loading
// /demo — so it must never reach the live matching engine, which spends money on
// every call (OpenAI embedding + Pinecone query + a Firestore hydration read per
// result). Real matches require a real signed-in member.
//
// Bonus: the demo keeps working when the connector is down or out of quota,
// which is exactly when you most want to show someone the UI.

const DEMO: MatchCandidate[] = [
  {
    id: 'demo-cafe',
    name: 'Nokku Coffee',
    memberType: 'vendor',
    neighborhood: 'Mission',
    city: 'San Francisco',
    category: 'Food & Beverage',
    score: 0.92,
    distanceMi: 0.3,
    reasons: ['They pour, you bake', 'Same block', 'Both do weekend pop-ups'],
    offers: ['espresso bar', 'cold brew cart'],
  },
  {
    id: 'demo-muralist',
    name: 'Dani Cruz',
    memberType: 'artist',
    neighborhood: 'Boyle Heights',
    city: 'San Francisco',
    category: 'Art & Design',
    score: 0.88,
    distanceMi: 1.1,
    reasons: ['You need a launch visual', 'Paints live at events'],
    offers: ['live mural', 'prints'],
  },
  {
    id: 'demo-cantina',
    name: 'El Tri Cantina',
    memberType: 'vendor',
    neighborhood: 'Boyle Heights',
    city: 'San Francisco',
    category: 'Food & Beverage',
    score: 0.84,
    distanceMi: 1.4,
    reasons: ['Brings the crowd', 'Has a liquor licence you don’t'],
    offers: ['taco stand', 'aguas frescas'],
  },
  {
    id: 'demo-greenhouse',
    name: 'Greenhouse Project',
    memberType: 'organizer',
    neighborhood: 'Highland Park',
    city: 'San Francisco',
    category: 'Community',
    score: 0.79,
    distanceMi: 2.0,
    reasons: ['Runs the market you want a booth at', 'Community org'],
    offers: ['plant swap', 'kids’ table'],
  },
  {
    id: 'demo-studio',
    name: 'Studio Nine',
    memberType: 'artist',
    neighborhood: 'Hayes Valley',
    city: 'San Francisco',
    category: 'Art & Design',
    score: 0.74,
    distanceMi: 0.6,
    reasons: ['Has the space', 'Hosts after-hours'],
    offers: ['event space', 'sound system'],
  },
]

// Canned "Opportunities near you" for the Admin demo — events other hosts are
// running that the demo member could REQUEST TO JOIN (the free, supply-side
// action). Same reason as demoMatches: the demo cookie must never hit the paid
// engine or a live event feed, and it should look alive when the connector is
// down. Mirrors what /api/vendor/opportunities returns for a real member.
const DEMO_OPPS: Opportunity[] = [
  {
    eventId: 'demo-evt-nightmarket',
    title: 'Mission Night Market',
    date: 'Sat Aug 9 · 5:00 PM',
    location: '24th St · San Francisco',
    hostId: 'demo-greenhouse',
    hostName: 'Greenhouse Project',
    fit: true,
    reasons: ['Needs a food vendor', 'Two blocks from you'],
    distanceMi: 0.2,
  },
  {
    eventId: 'demo-evt-launchnight',
    title: 'Hayes Valley Launch Night',
    date: 'Fri Aug 15 · 7:00 PM',
    location: 'Hayes Valley · San Francisco',
    hostId: 'demo-studio',
    hostName: 'Studio Nine',
    fit: true,
    reasons: ['Looking for a dessert pop-up', 'Matches what you offer'],
    distanceMi: 1.3,
  },
  {
    eventId: 'demo-evt-plantswap',
    title: 'Highland Park Plant Swap',
    date: 'Sun Aug 24 · 11:00 AM',
    location: 'Highland Park · San Francisco',
    hostId: 'demo-greenhouse',
    hostName: 'Greenhouse Project',
    fit: false,
    reasons: [],
    distanceMi: 2.1,
  },
]

/** Canned opportunities for a demo actor — the events they can request to join. */
export function demoOpportunities(limit = 8): Opportunity[] {
  return DEMO_OPPS.slice(0, limit)
}

/** Canned candidates for a demo actor. `query` just narrows them, so Search feels alive. */
export function demoMatches(query?: string, limit = 8): MatchCandidate[] {
  const q = query?.trim().toLowerCase()
  if (q) {
    const pool = DEMO.filter((c) =>
      [c.name, c.category, c.memberType, ...(c.offers ?? []), ...c.reasons]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
    // A search that matches nothing still shows the pool — a demo shouldn't dead-end.
    return (pool.length ? pool : DEMO).slice(0, limit)
  }
  // No query = the "For you" teaser: one of each member type (vendor, artist,
  // organizer) so it reads as a curated complementary set, not a long list.
  const seen = new Set<string>()
  const oneEach = DEMO.filter((c) => {
    const t = c.memberType || 'other'
    if (seen.has(t)) return false
    seen.add(t)
    return true
  })
  return oneEach.slice(0, limit)
}
