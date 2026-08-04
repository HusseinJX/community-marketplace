// The shopper taste profile — "tell us who you are and what you want to attend".
//
// Deliberately small. A profile is a handful of chips plus, optionally, a
// sentence in the person's own words. The free text is where the signal
// actually is: "I have a 4-year-old and no car" says more about which events
// suit someone than any taxonomy we could design.

export interface TastePreset {
  id: string
  label: string
  emoji: string
  /** Seeds the embedding. Written as things a matching event would say. */
  seed: string
}

/**
 * Interest chips. The seed text is what gets embedded, NOT the label — an
 * embedding of the bare word "Family" is close to nothing useful, while a
 * sentence describing family events lands right next to real listings.
 */
export const INTERESTS: TastePreset[] = [
  { id: 'family', label: 'Family & kids', emoji: '🧸',
    seed: 'family friendly activities for children and parents, kids workshops, all ages play, story and craft sessions for young children' },
  { id: 'music', label: 'Live music', emoji: '🎵',
    seed: 'live music, concerts, bands, DJ sets, jazz, choir and orchestral performances, dance parties' },
  { id: 'art', label: 'Art & exhibitions', emoji: '🎨',
    seed: 'art exhibitions, gallery openings, painting, sculpture, printmaking, photography shows, artist talks' },
  { id: 'food', label: 'Food & drink', emoji: '🍜',
    seed: 'food events, tastings, cooking classes, farmers markets, pop-up dinners, wine and beer tasting' },
  { id: 'outdoors', label: 'Outdoors & parks', emoji: '🌳',
    seed: 'outdoor activities, park events, gardens, walking tours, hikes, nature and wildlife, cleanups' },
  { id: 'learning', label: 'Talks & learning', emoji: '📚',
    seed: 'lectures, talks, panel discussions, book clubs, author readings, classes and seminars' },
  { id: 'tech', label: 'Tech & making', emoji: '🛠️',
    seed: 'technology meetups, hackathons, coding, electronics, maker workshops, creative technology, robotics' },
  { id: 'wellness', label: 'Wellness & movement', emoji: '🧘',
    seed: 'yoga, meditation, fitness classes, dance classes, health and wellbeing, running groups' },
  { id: 'community', label: 'Community & causes', emoji: '🤝',
    seed: 'volunteering, mutual aid, neighbourhood meetings, civic events, community organising, free resources' },
  { id: 'film', label: 'Film & theatre', emoji: '🎬',
    seed: 'film screenings, cinema, documentaries, theatre, performance art, comedy shows' },
]

export interface ShopperProfile {
  /** Chip ids from INTERESTS. */
  interests: string[]
  /** Free text — "who you are and what you want to see". The strongest signal. */
  about?: string
  /** Home point for proximity. */
  lat?: number | null
  lng?: number | null
  /** Miles. Null = no distance preference. */
  radiusMiles?: number | null
  /** Only surface events the source says are free. */
  freeOnly?: boolean
  /** Rough guide for how far ahead to look. */
  horizonDays?: number
}

/**
 * Turn a profile into the single string we embed.
 *
 * The free text is repeated so it carries more weight than the chips: someone
 * who ticks "Art" but writes "I want to meet other parents" should get parent
 * events, because they told us in words what a chip could never capture.
 */
export function profileToText(p: ShopperProfile): string {
  const chips = p.interests
    .map((id) => INTERESTS.find((i) => i.id === id)?.seed)
    .filter(Boolean)
  const parts = [...chips]
  if (p.about?.trim()) {
    const about = p.about.trim()
    parts.push(about, about) // weighted by repetition
  }
  return parts.join('. ')
}

/** A short, human sentence describing the profile — shown back to the user. */
export function describeProfile(p: ShopperProfile): string {
  const names = p.interests
    .map((id) => INTERESTS.find((i) => i.id === id)?.label)
    .filter(Boolean)
  const bits: string[] = []
  if (names.length) bits.push(names.join(', '))
  if (p.radiusMiles) bits.push(`within ${p.radiusMiles} mi`)
  if (p.freeOnly) bits.push('free only')
  return bits.join(' · ') || 'everything'
}
