import type { MatchCandidate } from '@/lib/types'

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
    reasons: ['Has the space', 'Hosts after-hours'],
    offers: ['event space', 'sound system'],
  },
]

/** Canned candidates for a demo actor. `query` just narrows them, so Search feels alive. */
export function demoMatches(query?: string, limit = 8): MatchCandidate[] {
  const q = query?.trim().toLowerCase()
  const pool = q
    ? DEMO.filter((c) =>
        [c.name, c.category, c.memberType, ...(c.offers ?? []), ...c.reasons]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : DEMO
  // A search that matches nothing still shows the pool — a demo shouldn't dead-end.
  return (pool.length ? pool : DEMO).slice(0, limit)
}
