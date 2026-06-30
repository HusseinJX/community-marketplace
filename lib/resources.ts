import type { BusinessContext } from './business-context'

// ──────────────────────────────────────────────────────────────────────────
// Small-business resources hub — static catalog.
//
// This is the data contract. Adding/editing a resource is just editing the
// `RESOURCES` array below. Real SF resources get dropped in here (with verified
// URLs); the UI, search, and recommendations all read from this one file.
//
// Improve-later hooks already baked in: `tags`/`recommendFor` (smarter recs),
// `city` (more cities), `cost` (filtering). None of those require a rewrite.
// ──────────────────────────────────────────────────────────────────────────

export type ResourceCategory =
  | 'legal'
  | 'accounting'
  | 'energy'
  | 'green'
  | 'accessibility'
  | 'permits'
  | 'funding'
  | 'education'
  | 'market-research'
  | 'library'
  | 'support-orgs'
  // Community (resident-facing) categories — used by the shopper resource
  // explorer (lib/community-resources.ts), not the small-business catalog.
  | 'food'
  | 'housing'
  | 'health'
  | 'mental-health'
  | 'legal-aid'
  | 'financial-help'
  | 'family'
  | 'jobs'
  | 'immigration'
  | 'seniors'
  | 'community'

export const CATEGORY_META: Record<ResourceCategory, { label: string; blurb: string }> = {
  legal: { label: 'Legal help', blurb: 'Contracts, leases, disputes, formation' },
  accounting: { label: 'Accounting & finance', blurb: 'Bookkeeping, taxes, financial planning' },
  energy: { label: 'Energy savings', blurb: 'Lower your utility bills' },
  green: { label: 'Green & sustainability', blurb: 'Certifications and greener operations' },
  accessibility: { label: 'Accessibility', blurb: 'Serving customers with disabilities, ADA' },
  permits: { label: 'Permits & licensing', blurb: 'Registration, permits, compliance' },
  funding: { label: 'Funding & grants', blurb: 'Loans, grants, capital' },
  education: { label: 'Training & workshops', blurb: 'Classes, courses, mentorship' },
  'market-research': { label: 'Market research', blurb: 'Data, business plans, market insight' },
  library: { label: 'Library resources', blurb: 'Free databases, events, reference help' },
  'support-orgs': { label: 'Support organizations', blurb: 'Hands-on help from local orgs' },
  // Community (resident-facing)
  food: { label: 'Food assistance', blurb: 'Groceries, meals, CalFresh' },
  housing: { label: 'Housing & rent', blurb: 'Rental help, shelters, tenant rights' },
  health: { label: 'Health & clinics', blurb: 'Free & low-cost care, insurance' },
  'mental-health': { label: 'Mental health', blurb: 'Counseling and crisis support' },
  'legal-aid': { label: 'Legal aid', blurb: 'Free legal help for residents' },
  'financial-help': { label: 'Financial help', blurb: 'Utility, cash & benefits assistance' },
  family: { label: 'Family & childcare', blurb: 'Childcare, family resource centers' },
  jobs: { label: 'Jobs & training', blurb: 'Job centers, ESL, adult education' },
  immigration: { label: 'Immigration', blurb: 'Citizenship and immigrant services' },
  seniors: { label: 'Seniors & disability', blurb: 'Services for older adults & disabilities' },
  community: { label: 'Community orgs', blurb: 'Mutual aid and neighborhood groups' },
}

export type ResourceCost = 'free' | 'low-cost' | 'varies'

export interface Resource {
  id: string
  title: string
  /** Who provides it. */
  org: string
  category: ResourceCategory
  /** One line for the card. */
  summary: string
  /** 2–4 sentences: what it offers, who it's for. */
  description: string
  cost: ResourceCost
  /**
   * Verified destination. If a real link isn't known yet, leave this `null` and
   * set `searchHint` — the UI renders a "Find this program →" search link
   * instead of ever showing a fabricated URL.
   */
  url: string | null
  /** Used to build a web-search fallback link when `url` is null. */
  searchHint?: string
  /** City-aware now so other cities slot in later without a schema change. */
  city: 'sf'
  /** Free-text signals for search + keyword matching. */
  tags: string[]
  /** Signals that drive the "Recommended for you" rail. */
  recommendFor: {
    /** Business categories this fits, e.g. 'restaurant','cafe','retail','maker'. */
    categories?: string[]
    /** Words to look for in the business's description/offerings. */
    keywords?: string[]
    /** Applies to essentially every SF small business (cert, permits, library…). */
    always?: boolean
  }
}

// ──────────────────────────────────────────────────────────────────────────
// PLACEHOLDER SEED — replace/expand with the real resources you send.
// URLs here are intentionally left null (search-fallback) until verified, so
// nothing fabricated ships. Treat these as shape examples, not final content.
// ──────────────────────────────────────────────────────────────────────────
export const RESOURCES: Resource[] = [
  {
    id: 'sf-office-small-business',
    title: 'SF Office of Small Business',
    org: 'City and County of San Francisco',
    category: 'permits',
    summary: 'Your first stop for permits, licensing, and free business advising.',
    description:
      'The central point of information for starting and running a business in San Francisco. Free one-on-one advising, help navigating permits and registration, and connections to other city resources.',
    cost: 'free',
    url: null,
    searchHint: 'SF Office of Small Business',
    city: 'sf',
    tags: ['permit', 'license', 'registration', 'advising', 'city', 'compliance'],
    recommendFor: { always: true },
  },
  {
    id: 'sf-green-business-program',
    title: 'SF Green Business Program',
    org: 'SF Environment',
    category: 'green',
    summary: 'Get certified green and lower your operating costs.',
    description:
      'Free certification that helps your business conserve energy and water, cut waste, and reduce costs — plus public recognition as a certified green business customers can look for.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco Green Business Program SF Environment',
    city: 'sf',
    tags: ['green', 'sustainability', 'certification', 'energy', 'waste', 'water'],
    recommendFor: { categories: ['restaurant', 'cafe', 'retail', 'food'], keywords: ['kitchen', 'cook', 'shop', 'store'] },
  },
  {
    id: 'sf-induction-cooktop-program',
    title: 'Induction cooktop loaner / rebate',
    org: 'SF Environment / BayREN',
    category: 'energy',
    summary: 'Try or get rebates on commercial induction cooking equipment.',
    description:
      'Programs that help food businesses switch from gas to electric induction cooking — through equipment loaners and rebates. Cleaner air in the kitchen and lower energy costs.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco commercial induction cooktop rebate loaner BayREN',
    city: 'sf',
    tags: ['induction', 'cooking', 'kitchen', 'electric', 'energy', 'rebate', 'gas'],
    recommendFor: { categories: ['restaurant', 'cafe', 'food', 'bakery'], keywords: ['kitchen', 'cook', 'menu', 'food', 'chef', 'bake'] },
  },
  {
    id: 'sf-library-business-center',
    title: 'Business & Nonprofit Center',
    org: 'SF Public Library',
    category: 'library',
    summary: 'Free market research databases, business plans, and reference help.',
    description:
      'The library offers free access to market-research databases, business-plan resources, small-business news, and librarians who can help you research your market and competitors — all at no cost.',
    cost: 'free',
    url: null,
    searchHint: 'SF Public Library Business Nonprofit Center',
    city: 'sf',
    tags: ['market research', 'business plan', 'database', 'library', 'reference', 'news', 'events'],
    recommendFor: { always: true },
  },
  {
    id: 'sf-accessibility-guide',
    title: 'Serving customers with disabilities',
    org: 'SF Office of Small Business',
    category: 'accessibility',
    summary: 'Make your storefront accessible and ADA-compliant.',
    description:
      'Guidance on making your physical space and service accessible to customers with disabilities, including ADA requirements and practical steps for storefronts.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco small business accessibility ADA storefront guide',
    city: 'sf',
    tags: ['accessibility', 'ada', 'disability', 'storefront', 'compliance'],
    recommendFor: { categories: ['restaurant', 'cafe', 'retail'], keywords: ['storefront', 'shop', 'store', 'location', 'dine-in'] },
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Recommendation engine — deterministic, no model call.
// "Slight but useful": always-on resources form a baseline; category and
// keyword matches bump a resource up and record *why* it was recommended.
// ──────────────────────────────────────────────────────────────────────────

export interface Recommendation {
  resource: Resource
  score: number
  /** Human-readable reasons, e.g. "You're a restaurant". */
  reasons: string[]
}

function haystack(ctx: BusinessContext): string {
  // The knowledge blob already concatenates description, offerings, products,
  // events, etc. — perfect free-text to keyword-match against.
  return `${ctx.businessName}\n${ctx.knowledgeBlob}`.toLowerCase()
}

/**
 * Rank resources for one business. Pure + deterministic — safe to unit test
 * with no API cost. Returns the recommended subset, most relevant first.
 */
export function recommendResources(
  ctx: BusinessContext,
  opts: { limit?: number; category?: string | null } = {}
): Recommendation[] {
  const hay = haystack(ctx)
  const category = (opts.category ?? '').toLowerCase().trim()

  const recs: Recommendation[] = []

  for (const resource of RESOURCES) {
    const reasons: string[] = []
    let score = 0
    const rf = resource.recommendFor

    if (rf.always) {
      score += 1
      reasons.push('Useful for every local business')
    }

    if (category && rf.categories?.length) {
      const hit = rf.categories.find((c) => category.includes(c) || c.includes(category))
      if (hit) {
        score += 5
        reasons.push(`You're a ${category}`)
      }
    } else if (rf.categories?.length) {
      // No explicit category on the profile — fall back to keyword evidence
      // of the category word appearing anywhere in the business's info.
      const hit = rf.categories.find((c) => hay.includes(c))
      if (hit) {
        score += 4
        reasons.push(`Looks like a ${hit} business`)
      }
    }

    if (rf.keywords?.length) {
      const matched = rf.keywords.filter((k) => hay.includes(k.toLowerCase()))
      if (matched.length) {
        score += 2 * matched.length
        reasons.push(`Matches your business (${matched.slice(0, 3).join(', ')})`)
      }
    }

    if (score > 0) recs.push({ resource, score, reasons: dedupe(reasons) })
  }

  recs.sort((a, b) => b.score - a.score)
  return typeof opts.limit === 'number' ? recs.slice(0, opts.limit) : recs
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr))
}

/** A web-search URL used when a resource has no verified link yet. */
export function searchUrl(resource: Resource): string {
  const q = encodeURIComponent(resource.searchHint || `${resource.title} ${resource.org}`)
  return `https://www.google.com/search?q=${q}`
}

/** Compact catalog rendering for grounding the chat model. */
export function resourcesForPrompt(): string {
  return RESOURCES.map((r) => {
    const link = r.url ?? `(no direct link — search: ${r.searchHint ?? r.title})`
    return `- [${r.id}] ${r.title} — ${r.org} (${CATEGORY_META[r.category].label}, ${r.cost}). ${r.summary} ${link}`
  }).join('\n')
}

export function getResource(id: string): Resource | undefined {
  return RESOURCES.find((r) => r.id === id)
}
