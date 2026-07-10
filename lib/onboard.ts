// Shared onboarding pieces: the profile-extraction JSON schema (used to turn an
// interview transcript or onboarding chat into a structured member profile) and
// the conversational onboarding system prompt.

export const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Business or person name' },
    memberType: {
      type: 'string',
      enum: ['vendor', 'artist', 'organizer', 'shopper', 'influencer'],
      description: 'Best-fit member type; default to "vendor" for a business/maker',
    },
    category: { type: ['string', 'null'], description: 'e.g. Food & Drink, Crafts, Wellness' },
    subcategory: { type: ['string', 'null'] },
    city: { type: ['string', 'null'] },
    neighborhood: { type: ['string', 'null'] },
    businessDescription: { type: ['string', 'null'], description: 'One or two sentences in their voice' },
    products: { type: 'array', items: { type: 'string' }, description: 'Things they sell/make' },
    services: { type: 'array', items: { type: 'string' } },
    priceRange: { type: ['string', 'null'], description: 'e.g. $, $$, "$5–15"' },
    phone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    instagramHandle: { type: ['string', 'null'], description: 'Handle without the @' },
    websiteUrl: { type: ['string', 'null'] },
  },
  required: [
    'name', 'memberType', 'category', 'subcategory', 'city', 'neighborhood',
    'businessDescription', 'products', 'services', 'priceRange', 'phone', 'email',
    'instagramHandle', 'websiteUrl',
  ],
  additionalProperties: false,
} as const

export interface ExtractedProfile {
  name: string
  memberType: 'vendor' | 'artist' | 'organizer' | 'shopper' | 'influencer'
  category: string | null
  subcategory: string | null
  city: string | null
  neighborhood: string | null
  businessDescription: string | null
  products: string[]
  services: string[]
  priceRange: string | null
  phone: string | null
  email: string | null
  instagramHandle: string | null
  websiteUrl: string | null
}

export const EXTRACT_INSTRUCTION =
  'You are profiling a local business/person from a conversation transcript or interview notes. ' +
  'Extract only what is stated or clearly implied — do not invent details. Leave unknown fields null ' +
  '(or empty arrays). Write the description in a warm, first-person-friendly tone.'

// A compact "what we already know" brief, stitched from the Google Places seed
// and/or a fast web-search research pass, to WARM the onboarding interview. When
// present, the interviewer opens by reflecting it back and confirming — the
// "wow, it already knows me" moment — before moving on to new questions.
export interface BriefInput {
  name?: string | null
  category?: string | null
  subcategory?: string | null
  city?: string | null
  neighborhood?: string | null
  description?: string | null
  products?: string[] | null
  services?: string[] | null
  websiteUrl?: string | null
  instagramHandle?: string | null
  research?: string | null // raw web-search prose (Perplexity)
}

export function buildInterviewBrief(input: BriefInput): string {
  const lines: string[] = []
  const place = [input.neighborhood, input.city].filter(Boolean).join(', ')
  if (input.name) lines.push(`Name: ${input.name}`)
  const cat = [input.category, input.subcategory].filter(Boolean).join(' · ')
  if (cat) lines.push(`Category: ${cat}`)
  if (place) lines.push(`Where: ${place}`)
  if (input.description) lines.push(`About: ${input.description}`)
  const offerings = [...(input.products || []), ...(input.services || [])].filter(Boolean)
  if (offerings.length) lines.push(`Known for: ${offerings.slice(0, 8).join(', ')}`)
  if (input.websiteUrl) lines.push(`Website: ${input.websiteUrl}`)
  if (input.instagramHandle) lines.push(`Instagram: @${String(input.instagramHandle).replace(/^@/, '')}`)
  if (input.research) lines.push(`Web research:\n${String(input.research).trim().slice(0, 1400)}`)
  return lines.join('\n').trim()
}

// The single most important behavior: this should feel like a warm chat, not a
// form. One question at a time, always.
const PACE =
  'Ask exactly ONE question per message, then stop and wait for their answer. Never stack ' +
  'two questions or read a checklist. Keep every message short, warm, and casual, and react ' +
  'to what they actually said before moving on.'

// The collaboration ask is the real prize of the interview — once the member
// feels seen, steer toward how they'd like to connect with the local network.
const COLLAB_NUDGE =
  'The most valuable thing to learn is how they want to collaborate — who they would love to ' +
  'work with (other makers, venues, organizers), what kinds of events or partnerships excite ' +
  'them, and what they need help with or can offer others. Get to this naturally once they have ' +
  'warmed up, and prioritize it over collecting contact details (those are optional and come last).'

// Preamble that makes the host open with what we already researched, so the
// person feels recognized and opens up. Empty when we have no brief.
function briefPreamble(brief?: string): string {
  if (!brief || !brief.trim()) return ''
  return [
    'Before this conversation started, we researched them. Here is what we found:',
    '"""',
    brief.trim(),
    '"""',
    'For your VERY FIRST message: give a warm greeting, reflect back ONE genuinely specific detail',
    'from the research above (their neighborhood, how long they have been going, a real specialty),',
    'and ask ONE short question to confirm it. Then STOP — do not ask anything else in that first',
    'message; let them respond first. That single recognized detail is what makes them feel known.',
    'CRITICAL: only ever mention specifics that literally appear in the research above. Never guess,',
    'embellish, or invent a dish, menu item, specialty, or fact — inventing one detail breaks all',
    'the trust the recognition earned. If a detail is not written above, do not say it. If the',
    'research could not confirm them, skip the recognition and simply open with one warm question.',
  ].join(' ')
}

// System prompt for the interactive onboarding chat (QR self-onboarding).
export function onboardingSystemPrompt(eventName?: string, opts?: { brief?: string }): string {
  return [
    'You are a friendly WhatsLocal onboarding host helping a small business or maker join',
    eventName ? `the "${eventName}" event and the WhatsLocal community.` : 'the WhatsLocal community.',
    briefPreamble(opts?.brief),
    PACE,
    'Over the conversation (not all at once) get a feel for what they sell or do, their category,',
    'the neighborhood they operate in, price range, whether it is just them or a small team, and',
    'how long they have been going.',
    COLLAB_NUDGE,
    'Contact details and socials (phone, Instagram, website) are optional — ask lightly near the end,',
    'or skip them. Do not assume where they are or greet them as if they are physically at a market',
    'or booth.',
    'Once you have the basics (at least what they do), let them know they can tap "Create my profile"',
    'whenever they are ready. Do not try to collect everything; respect their time.',
  ].filter(Boolean).join(' ')
}

// Spoken-style system prompt for the in-browser VOICE onboarding interview
// (OpenAI Realtime). Used by /join after a business is verified — the goal is to
// GATHER their profile in a short warm conversation, not to answer as a business.
export function interviewVoicePrompt(opts?: { name?: string; kind?: string; brief?: string }): string {
  const who = opts?.name ? `"${opts.name}"` : 'a local business or maker'
  const pre = briefPreamble(opts?.brief)
  return [
    `You are a warm, upbeat WhatsLocal onboarding host on a live voice call, interviewing ${who}`,
    'to build their community profile. This is a real spoken conversation — keep every turn to a',
    'sentence or two and let them talk.',
    '',
    pre ||
      'Open by welcoming them by name and saying you just need a couple of minutes to bring their page to life and power their local matches, then ask one easy opening question.',
    PACE,
    'Over the call get a feel for what they sell or do, their category, the neighborhood they',
    'operate in, price range, what makes them special, and whether it is just them or a small team.',
    COLLAB_NUDGE,
    'Contact and socials (Instagram, website) are optional — ask lightly near the end or skip them.',
    '',
    'Be conversational and encouraging — react to their answers, never read a list aloud. When you',
    'have the basics, warmly let them know they are all set and can tap "Finish" whenever they are',
    'ready. Do not drag it out; respect their time.',
  ].filter(Boolean).join(' ')
}
