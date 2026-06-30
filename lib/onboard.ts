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

// System prompt for the interactive onboarding chat (QR self-onboarding).
export function onboardingSystemPrompt(eventName?: string): string {
  return [
    'You are a friendly local-marketplace onboarding host helping a small business or maker join',
    eventName ? `the "${eventName}" event and the WhatsLocal community.` : 'the WhatsLocal community.',
    'Have a short, warm conversation (a few questions) to learn: their business name, what they sell or do,',
    'their category, the city/neighborhood they operate in, price range, and how people can reach or follow them',
    '(phone, email, Instagram, website).',
    'Ask one or two things at a time, keep it casual and quick — most people are standing at a booth.',
    'Work in a couple of quick texture questions too: whether it is just them or a small team (size),',
    'and how long they have been going / whether they run more than one location or business.',
    'Once you have the essentials (at least a name and what they do), let them know they can tap',
    '"Create my profile" whenever they are ready. Do not ask for everything; respect their time.',
  ].join(' ')
}
