// Structured audience metadata — the honest half of the recommender.
//
// WHY THIS EXISTS: pure embedding similarity ranks well but explains badly.
// "Social: Afternoon Board Games" scores 0.396 against "outdoors & parks",
// which is a real number that means nothing — and an explanation built on it
// ("matches your interest in outdoors") is simply false.
//
// So both sides get the SAME structured vocabulary: an event says who it is
// for, a person says who they are and what they want, and a match can state
// its reason as fact rather than inferring one from a cosine.
//
// Cost shape matches the scraper's rule: the model runs ONCE per new event,
// never per request. ~$0.11 for all 796; ~$0.03/week for new arrivals.

import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import type { ScrapedEvent } from '@/lib/sources/types'

/** Controlled topic vocabulary. Shared by events and people so they compare. */
export const TOPICS = [
  'music', 'film', 'theatre', 'comedy', 'visual-art', 'craft-making', 'books-writing',
  'tech', 'science', 'food-drink', 'markets', 'outdoors-nature', 'sports-fitness',
  'wellness', 'history-culture', 'language', 'kids-family', 'community-civic',
  'volunteering', 'jobs-money', 'health-services',
] as const
export type Topic = (typeof TOPICS)[number]

export const ENERGIES = ['quiet', 'social', 'lively'] as const
export type Energy = (typeof ENERGIES)[number]

export const FORMATS = ['drop-in', 'register', 'ticketed'] as const
export const TIMES = ['morning', 'afternoon', 'evening', 'late'] as const

export interface EventAudience {
  topics: Topic[]
  energy: Energy | null
  /** Youngest/oldest this is genuinely aimed at. null = no age framing. */
  minAge: number | null
  maxAge: number | null
  kidsWelcome: boolean | null
  adultsOnly: boolean | null
  format: (typeof FORMATS)[number] | null
  timeOfDay: (typeof TIMES)[number] | null
  outdoor: boolean | null
  /** Would someone new to the city / arriving alone feel fine here? */
  newcomerFriendly: boolean | null
  /** One short line naming who it is for. Used verbatim in explanations. */
  idealAudience: string | null
}

const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          topics: { type: 'array', items: { type: 'string', enum: [...TOPICS] } },
          energy: { type: ['string', 'null'], enum: [...ENERGIES, null] },
          minAge: { type: ['integer', 'null'] },
          maxAge: { type: ['integer', 'null'] },
          kidsWelcome: { type: ['boolean', 'null'] },
          adultsOnly: { type: ['boolean', 'null'] },
          format: { type: ['string', 'null'], enum: [...FORMATS, null] },
          timeOfDay: { type: ['string', 'null'], enum: [...TIMES, null] },
          outdoor: { type: ['boolean', 'null'] },
          newcomerFriendly: { type: ['boolean', 'null'] },
          idealAudience: { type: ['string', 'null'] },
        },
        required: ['id', 'topics', 'energy', 'minAge', 'maxAge', 'kidsWelcome', 'adultsOnly',
                   'format', 'timeOfDay', 'outdoor', 'newcomerFriendly', 'idealAudience'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const EVENT_PROMPT = `You label community events with who they are for, so a neighbourhood app can recommend them honestly.

Rules that matter more than completeness:
- Use ONLY what the event text supports. If it does not indicate something, return null. Never infer.
- A confidently wrong label is worse than a null one: it makes the whole feed look like it is guessing.
- minAge/maxAge only when an age range is actually implied ("toddlers", "teens", "21+"). Otherwise null.
- kidsWelcome: true only for events plainly suitable for children. An adult lecture is false, not null.
- energy: quiet = reading, talks, gardens; social = classes, meetups, markets; lively = parties, concerts, festivals.
- format: "drop-in" when no signup is mentioned or it says drop-in; "register" when RSVP/registration needed; "ticketed" when there is paid admission.
- idealAudience: one short phrase, max 8 words, naming the person this suits ("parents with under-5s", "anyone curious about plants"). Plain language, no marketing.`

/**
 * Alcohol / adult-venue markers. Evidence, not inference.
 *
 * The model labelled "$1 Margaritas & Disco Taco Tuesday at Underdogs" as
 * `kidsWelcome: true, adultsOnly: false`, which put a bar night at the top of a
 * feed asked for toddler activities. The prompt already says never to guess;
 * this is the backstop for when it does anyway.
 *
 * Deliberately one-directional — it can only ever make an event LESS
 * kid-eligible. A rule that could add eligibility would be making exactly the
 * kind of claim this exists to prevent.
 */
const ADULT_MARKERS =
  /\b(21\+|18\+|margarita|cocktail|happy hour|open bar|beer|brewery|brewing|wine|winery|whiske?y|bourbon|tequila|mezcal|vodka|pub crawl|nightclub|burlesque|drag brunch|speakeasy|distillery|booze|boozy|cannabis|dispensary)\b/i

// "lounge" is NOT here, and that omission is load-bearing: it matched the five
// "Flower Piano Lounge" concerts, which are family events in the Botanical
// Garden. A word that names a hotel lobby as readily as a cocktail bar cannot
// carry an eligibility decision.
const ADULT_VENUE = /\b(tavern|saloon|cantina|nightclub|brewery|taproom|winery|pub)\b/i

/**
 * Never promotes; only withdraws a kid-friendly claim the text doesn't support.
 *
 * Reads TITLE AND VENUE ONLY, never the description. A passing mention of beer
 * three paragraphs into a makerspace tour is not what the event is; a bar in
 * its name or address is.
 */
export function guardKidsWelcome(
  a: EventAudience,
  parts: { title: string; venue?: string | null }
): EventAudience {
  if (a.kidsWelcome !== true && a.adultsOnly !== false) return a
  const text = `${parts.title} ${parts.venue ?? ''}`
  if (!ADULT_MARKERS.test(text) && !ADULT_VENUE.test(text)) return a
  return { ...a, kidsWelcome: false, adultsOnly: a.adultsOnly === false ? null : a.adultsOnly }
}

/** Compact text we hand the model per event. Enough context, no boilerplate. */
function eventBrief(e: ScrapedEvent): string {
  return [
    `id: ${e.uid}`,
    `title: ${e.title}`,
    e.tags.length ? `tags: ${e.tags.join(', ')}` : '',
    e.venue ? `venue: ${e.venue}` : '',
    e.start ? `starts: ${e.start}` : '',
    e.free === true ? 'cost: free' : '',
    e.description ? `about: ${e.description.slice(0, 320)}` : '',
  ].filter(Boolean).join('\n')
}

/** Label a batch of events. Batched to keep the call count (and cost) sane. */
export async function extractEventAudience(
  events: ScrapedEvent[]
): Promise<Record<string, EventAudience>> {
  if (!events.length) return {}
  const res = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: EVENT_PROMPT },
      { role: 'user', content: events.map(eventBrief).join('\n---\n') },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'audience_labels', schema: EVENT_SCHEMA, strict: true },
    },
  })

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{"items":[]}') as {
    items: (EventAudience & { id: string })[]
  }
  const out: Record<string, EventAudience> = {}
  for (const it of parsed.items ?? []) {
    const { id, ...rest } = it
    // Only keep labels for ids we actually asked about — a hallucinated id
    // would otherwise attach a stranger's audience to nothing at all.
    const ev = events.find((e) => e.uid === id)
    if (ev) out[id] = guardKidsWelcome(rest, { title: ev.title, venue: ev.venue })
  }
  return out
}

// ── person side ──────────────────────────────────────────────────────────────

export interface PersonaFacts {
  topics: Topic[]
  /** Energies they'd enjoy. Empty = no preference. */
  energies: Energy[]
  /** Ages of children they'd bring. Empty = not bringing kids. */
  childAges: number[]
  adultOnlyOk: boolean | null
  freeOnly: boolean | null
  /** Times they are actually available. Empty = any. */
  times: (typeof TIMES)[number][]
  prefersOutdoor: boolean | null
  /** True when they signalled being new / wanting to meet people. */
  wantsToMeetPeople: boolean | null
  /** Max travel in miles, if stated ("no car", "walking distance"). */
  maxMiles: number | null
  /** One line back to the user confirming what we heard. */
  summary: string
}

const PERSONA_SCHEMA = {
  type: 'object',
  properties: {
    topics: { type: 'array', items: { type: 'string', enum: [...TOPICS] } },
    energies: { type: 'array', items: { type: 'string', enum: [...ENERGIES] } },
    childAges: { type: 'array', items: { type: 'integer' } },
    adultOnlyOk: { type: ['boolean', 'null'] },
    freeOnly: { type: ['boolean', 'null'] },
    times: { type: 'array', items: { type: 'string', enum: [...TIMES] } },
    prefersOutdoor: { type: ['boolean', 'null'] },
    wantsToMeetPeople: { type: ['boolean', 'null'] },
    maxMiles: { type: ['number', 'null'] },
    summary: { type: 'string' },
  },
  required: ['topics', 'energies', 'childAges', 'adultOnlyOk', 'freeOnly', 'times',
             'prefersOutdoor', 'wantsToMeetPeople', 'maxMiles', 'summary'],
  additionalProperties: false,
} as const

const PERSONA_PROMPT = `Turn what someone says into structured preferences for a local events feed.

They may phrase it ANY of these ways, and all are equally valid:
- a WANT — "I want more reading events", "more tech stuff", "show me live music"
- a VIBE — "chill things", "something lively", "quiet daytime stuff"
- an IDENTITY — "I'm a retired teacher", "I have a 4-year-old and no car"
- a mix of all three.

Never require them to describe themselves. "More reading events" is a complete answer: topics ["books-writing"], everything else null or empty.

Read practical constraints out of plain speech:
- "no car" / "walking distance" / "nearby" → maxMiles about 1.5
- "broke", "no money", "free" → freeOnly true
- "chill", "quiet", "low key" → energies ["quiet"]
- "meet people", "new in town", "make friends" → wantsToMeetPeople true
- "I have a 4-year-old" → childAges [4]
- "evenings", "after work" → times ["evening"]

Leave anything they did not indicate as null or an empty array. Do not invent constraints.

summary: one warm sentence, second person, reflecting what you heard. e.g. "Quiet, bookish things close to home." Max 12 words.`

/** Parse free text — a want, a vibe, or a self-description — into facts. */
export async function extractPersona(text: string): Promise<PersonaFacts> {
  const res = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: PERSONA_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'persona_facts', schema: PERSONA_SCHEMA, strict: true },
    },
  })
  return JSON.parse(res.choices[0]?.message?.content ?? '{}') as PersonaFacts
}
