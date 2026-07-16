// Fully-formed collaboration IDEAS for the public /businesses door.
//
// A list of matched businesses makes the visitor do the creative work ("ok…
// so what do I do with a muralist?"). The engine's actual value is the idea it
// assembles: a concrete event, the specific people in it, the reason each one is
// there, and the first three moves. That's the thing nobody thinks of alone.
//
// These are canned (no auth, no paid engine call) but they mirror exactly what
// the connector's convener produces for a signed-in member: invent-event → fill
// each role with a real complementary match.

export interface IdeaRole {
  /** What this business brings — the role, not the category. */
  role: string
  name: string
  /** Why the matcher picked THEM for this role. */
  why: string
  emoji: string
}

export interface CollabIdea {
  id: string
  /** The event, named. */
  title: string
  /** One line: the shape of the night. */
  pitch: string
  /** The insight — why this combination works, stated plainly. */
  insight: string
  lineup: IdeaRole[]
  /** The first three moves, so "plan it" isn't abstract. */
  steps: string[]
  /** Rough effort, to make it feel doable. */
  effort: string
}

/** An event someone ELSE is already putting on, that you could join. */
export interface OpenEvent {
  id: string
  title: string
  host: string
  when: string
  where: string
  /** The gap in their lineup — the reason there's room for you. */
  needs: string
  /** Why the matcher thinks you fit it. */
  why: string
  /** Who's already in, so it reads as real. */
  lineup: string[]
  emoji: string
}

// The other door: you don't have to invent anything. These are events already
// happening that have a hole shaped like you. Lower commitment than starting
// one — and usually the first collaboration a business ever does.
export const OPEN_EVENTS: OpenEvent[] = [
  {
    id: 'demo-open-1',
    title: 'Sunset Farmers Market',
    host: 'Greenhouse Project',
    when: 'Every Saturday · 9am–1pm',
    where: 'Sunset',
    needs: 'Looking for a food partner',
    why: 'Their lineup has no hot food — and you already trade Saturdays',
    lineup: ['Rosa’s Tamales', 'Kite & String Ceramics', '+9 more'],
    emoji: '🌱',
  },
  {
    id: 'demo-open-2',
    title: 'Mission Night Market',
    host: 'El Tri Cantina',
    when: 'Fri 15 Aug · 6pm–11pm',
    where: 'Valencia St',
    needs: 'Looking for makers + a dessert stall',
    why: 'Three food stalls, nothing sweet; you close before their peak',
    lineup: ['Dani Cruz', 'Nokku Coffee', '+4 more'],
    emoji: '🌮',
  },
  {
    id: 'demo-open-3',
    title: 'Small Business Saturday block party',
    host: 'Bayview Merchants',
    when: 'Sat 29 Nov · 11am–5pm',
    where: 'Third St',
    needs: 'Open to any local business on the block',
    why: 'You’re on the street they’re closing',
    lineup: ['Bayview Bike Co-op', '+12 more'],
    emoji: '🎉',
  },
]

export const COLLAB_IDEAS: CollabIdea[] = [
  {
    id: 'night-market',
    title: 'Friday Night Market on your block',
    pitch: 'Close the sidewalk at 6pm. Food, a live mural, and a reason to stay after dinner.',
    insight:
      'Your busiest hour ends when theirs begins. A taco cart and a muralist both pull a crowd you never see — and all three of you are already open on Friday.',
    lineup: [
      { role: 'Draws the after-work crowd', name: 'El Tri Cantina', why: 'Has the liquor licence you don’t', emoji: '🌮' },
      { role: 'Makes it worth photographing', name: 'Dani Cruz', why: 'Paints live at events — free foot traffic', emoji: '🎨' },
      { role: 'Keeps people there past 9', name: 'Nokku Coffee', why: 'Late espresso bar; they close as you peak', emoji: '☕' },
    ],
    steps: [
      'Pick a Friday 3–4 weeks out',
      'Split one permit + one flyer three ways',
      'Each of you posts it once — three audiences, one night',
    ],
    effort: 'One evening · shared cost',
  },
  {
    id: 'mural-launch',
    title: 'Storefront mural launch',
    pitch: 'Turn a repaint into an event: the wall goes up live, with coffee and a small crowd.',
    insight:
      'You were going to repaint anyway. Doing it in public turns a maintenance cost into an opening night — and the wall keeps working for you afterwards.',
    lineup: [
      { role: 'Paints it live', name: 'Dani Cruz', why: 'Muralist, works in front of a crowd', emoji: '🎨' },
      { role: 'Brings the morning crowd', name: 'Nokku Coffee', why: 'Cold-brew cart — gives people a reason to linger', emoji: '☕' },
    ],
    steps: ['Agree the wall + the weekend', 'Artist posts progress for a week', 'Open the doors on reveal day'],
    effort: 'One weekend · low cost',
  },
  {
    id: 'market-booth',
    title: 'Share a booth at the farmers market',
    pitch: 'One stall, two businesses, half the fee — and twice the reason to stop.',
    insight:
      'A booth on your own is a hard sell for a Saturday. Paired with someone whose product finishes yours, it becomes a stop instead of a stall.',
    lineup: [
      { role: 'Splits the stall with you', name: 'Greenhouse Project', why: 'Runs the market — can get you the slot', emoji: '🌱' },
      { role: 'Pulls the family crowd', name: 'Rosa’s Tamales', why: 'Sells out by 11am; you catch the queue', emoji: '🫔' },
    ],
    steps: ['Ask the organiser for one shared slot', 'Split the fee + the table', 'Bring one thing each you don’t normally sell'],
    effort: 'One Saturday · split fee',
  },
]
