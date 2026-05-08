import { GoogleGenerativeAI } from '@google/generative-ai'
import type { MemberProfile } from './types'

export type VerificationMethod = 'phone' | 'website_email' | 'instagram' | 'gemini'

export interface VerificationResult {
  verified: boolean
  method: VerificationMethod
  evidence: Record<string, unknown>
}

// ─── Google Places API ───────────────────────────────────────────────────────

async function fetchPlacePhone(googleMapsUrl: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  // Extract the place name/query from the URL for Text Search
  const searchText = await extractPlaceSearchQuery(googleMapsUrl)
  if (!searchText) return null

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.nationalPhoneNumber,places.internationalPhoneNumber,places.displayName',
    },
    body: JSON.stringify({ textQuery: searchText }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const place = data.places?.[0]
  return place?.nationalPhoneNumber ?? place?.internationalPhoneNumber ?? null
}

function extractPlaceSearchQuery(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url)
    // Handle /maps/place/Business+Name/@lat,lng or /maps/search/query
    const placeMatch = decoded.match(/\/maps\/place\/([^/@]+)/)
    if (placeMatch) return placeMatch[1].replace(/\+/g, ' ')
    const searchMatch = decoded.match(/\/maps\/search\/([^/@?]+)/)
    if (searchMatch) return searchMatch[1].replace(/\+/g, ' ')
    // q= param
    const u = new URL(url)
    return u.searchParams.get('q')
  } catch {
    return null
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// ─── Firecrawl ───────────────────────────────────────────────────────────────

async function scrapeWebsiteEmails(websiteUrl: string): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return []

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: websiteUrl,
      formats: ['markdown'],
      onlyMainContent: false,
    }),
  })

  if (!res.ok) return []
  const data = await res.json()
  const text: string = data.data?.markdown ?? ''

  const emails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? []
  return [...new Set(emails.map((e) => e.toLowerCase()))]
}

// ─── Gemini fallback ─────────────────────────────────────────────────────────

async function verifyWithGemini(
  claimedValue: string,
  profile: MemberProfile
): Promise<{ verified: boolean; reasoning: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { verified: false, reasoning: 'Gemini not configured' }

  const genai = new GoogleGenerativeAI(apiKey)
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const links = [
    profile.googleMapsUrl && `Google Maps: ${profile.googleMapsUrl}`,
    profile.websiteUrl && `Website: ${profile.websiteUrl}`,
    profile.instagramHandle && `Instagram: https://instagram.com/${profile.instagramHandle}`,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `You are verifying whether someone is the owner of a business.

Business name: ${profile.businessName ?? profile.name ?? 'unknown'}
Business links:
${links}

The person claims to be associated with this business and provided: "${claimedValue}"

Please visit the links above and determine if "${claimedValue}" appears as a contact point
(phone number, email address, or Instagram handle) for this business.

Respond with JSON only: { "verified": true/false, "reasoning": "one sentence explanation" }`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  try {
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(cleaned)
  } catch {
    return { verified: false, reasoning: text }
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function verifyBusinessOwnership(
  method: VerificationMethod,
  claimedValue: string,
  profile: MemberProfile
): Promise<VerificationResult> {
  if (method === 'instagram') {
    const handle = (profile.instagramHandle ?? '').replace(/^@/, '').toLowerCase()
    const claimed = claimedValue.replace(/^@/, '').toLowerCase()
    return {
      verified: handle !== '' && handle === claimed,
      method: 'instagram',
      evidence: { onFile: handle, claimed },
    }
  }

  if (method === 'phone') {
    const onFile = normalizePhone(profile.businessPhone ?? '')
    const claimed = normalizePhone(claimedValue)

    if (onFile && onFile === claimed) {
      return { verified: true, method: 'phone', evidence: { source: 'profile', onFile, claimed } }
    }

    // Cross-check against live GMaps listing
    if (profile.googleMapsUrl) {
      const livePhone = await fetchPlacePhone(profile.googleMapsUrl)
      if (livePhone) {
        const liveNorm = normalizePhone(livePhone)
        if (liveNorm === claimed) {
          return { verified: true, method: 'phone', evidence: { source: 'places_api', livePhone, claimed } }
        }
      }
    }

    return { verified: false, method: 'phone', evidence: { onFile, claimed } }
  }

  if (method === 'website_email') {
    const claimed = claimedValue.toLowerCase().trim()
    if (profile.websiteUrl) {
      const emails = await scrapeWebsiteEmails(profile.websiteUrl)
      if (emails.includes(claimed)) {
        return { verified: true, method: 'website_email', evidence: { found: emails, claimed } }
      }
    }
    return { verified: false, method: 'website_email', evidence: { claimed } }
  }

  if (method === 'gemini') {
    const { verified, reasoning } = await verifyWithGemini(claimedValue, profile)
    return { verified, method: 'gemini', evidence: { claimed: claimedValue, reasoning } }
  }

  return { verified: false, method, evidence: {} }
}

// Which verification options are available for a given profile
export function availableVerificationMethods(profile: MemberProfile): VerificationMethod[] {
  const methods: VerificationMethod[] = []
  if (profile.businessPhone || profile.googleMapsUrl) methods.push('phone')
  if (profile.websiteUrl) methods.push('website_email')
  if (profile.instagramHandle) methods.push('instagram')
  methods.push('gemini') // always available as fallback
  return methods
}
