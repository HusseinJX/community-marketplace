/**
 * Search-side fixtures for the Growth console demo (`/vendor/growth`).
 *
 * Same warning as `lib/growth-demo.ts`: none of this is real. The shapes mirror
 * what the APIs actually return — Search Console's query rows (query, clicks,
 * impressions, CTR, position) and Business Profile's insight counters — so the
 * components don't have to change when the real clients land.
 */

export interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  /** Average position. Lower is better; 1.0 is the top organic result. */
  position: number
  /** Position in the previous period, for the movement arrow. */
  priorPosition: number
  /** True when we're leaving obvious money on the table — drives the panel. */
  opportunity?: string
}

/**
 * Ordered by impressions, which is how the opportunity reads: the queries
 * putting you in front of the most people while you rank badly are the ones
 * worth a page, and they are never the ones a vendor guesses.
 *
 * These are 28-DAY figures, and they have to stay under the last four entries
 * of `ORGANIC_WEEKS` — ten tracked terms cannot account for more clicks than
 * the whole site received. They currently sit at roughly 80% of it, which is
 * what a head-heavy local search profile looks like.
 */
export const QUERIES: SearchQuery[] = [
  {
    query: 'best croissant san francisco',
    clicks: 42,
    impressions: 10236,
    position: 19.6,
    priorPosition: 22.4,
    opportunity:
      '10,000 people saw you last month and 42 clicked. Page two gets no clicks — you need a reason to be on page one for this.',
  },
  {
    query: 'custom cakes sf',
    clicks: 66,
    impressions: 6312,
    position: 14.2,
    priorPosition: 14.0,
    opportunity: 'No page on your site is about custom cakes. Google is ranking your homepage by default.',
  },
  { query: 'sourdough san francisco', clicks: 123, impressions: 3714, position: 8.4, priorPosition: 9.7 },
  { query: 'bakery sunset district', clicks: 294, impressions: 2673, position: 3.1, priorPosition: 4.2 },
  { query: 'gluten free bakery sf', clicks: 54, impressions: 2292, position: 11.8, priorPosition: 11.1 },
  { query: 'sunset sourdough', clicks: 1206, impressions: 1830, position: 1.0, priorPosition: 1.0 },
  {
    query: 'bakery open sunday sf',
    clicks: 99,
    impressions: 1626,
    position: 6.9,
    priorPosition: 8.8,
    opportunity:
      'You are open Sunday and it is not stated on any page — only in your hours widget, which Google cannot read.',
  },
  { query: 'irving street bakery', clicks: 171, impressions: 1164, position: 2.4, priorPosition: 2.6 },
  { query: 'sourdough classes san francisco', clicks: 27, impressions: 891, position: 16.3, priorPosition: 18.9 },
  { query: 'bakery near golden gate park', clicks: 36, impressions: 723, position: 9.2, priorPosition: 8.4 },
]

export type IssueSeverity = 'high' | 'medium' | 'low'

export interface SiteIssue {
  id: string
  severity: IssueSeverity
  title: string
  where: string
  detail: string
  /** Whether the agent can fix it without touching code we don't control. */
  fixable: 'agent' | 'needs-access'
}

export const SITE_ISSUES: SiteIssue[] = [
  {
    id: 'i-lcp',
    severity: 'high',
    title: 'Homepage takes 4.2s to load on mobile',
    where: 'sunsetsourdough.com',
    detail:
      'A 2.8MB hero photo, uncompressed. Over half the people who tap your ad leave before the page paints — you are paying $1.74 a click for a page most of them never see.',
    fixable: 'needs-access',
  },
  {
    id: 'i-meta',
    severity: 'medium',
    title: '3 pages have no meta description',
    where: '/menu · /classes · /wholesale',
    detail: 'Google writes its own from the first text it finds. All three already get impressions.',
    fixable: 'agent',
  },
  {
    id: 'i-schema',
    severity: 'medium',
    title: 'No LocalBusiness structured data',
    where: 'Every page',
    detail:
      'Hours, address and price range are on the page as text but not marked up, so they cannot appear in the search result itself.',
    fixable: 'agent',
  },
  {
    id: 'i-title',
    severity: 'low',
    title: 'Menu page title is cut off in results',
    where: '/menu — 71 characters',
    detail: '"Our Full Menu — Breads, Pastries, Cakes and Seasonal…" Google truncates at about 60.',
    fixable: 'agent',
  },
  {
    id: 'i-links',
    severity: 'low',
    title: '2 broken links',
    where: '/classes → /booking-old, footer → Instagram (old handle)',
    detail: 'Both return 404. One of them is in the footer, so it is on every page.',
    fixable: 'needs-access',
  },
]

/** Google Business Profile — the panel most local searches actually end at. */
export const GBP = {
  completeness: 78,
  /** The specific gaps behind that number. */
  missing: ['Services list', 'Products from your catalogue', '2 of 7 days have no hours confirmed'],
  searches30d: 1436,
  searchSplit: { discovery: 68, direct: 32 },
  calls30d: 214,
  directions30d: 96,
  websiteClicks30d: 341,
  photos90d: 4,
  lastPostDaysAgo: 47,
  reviews: { total: 186, average: 4.6, unanswered: 12, newThisMonth: 9 },
} as const

/** Organic clicks per week, oldest → newest. Feeds the trend chart. */
export const ORGANIC_WEEKS: { week: string; clicks: number; impressions: number }[] = [
  { week: 'Jul 7', clicks: 486, impressions: 8210 },
  { week: 'Jul 14', clicks: 502, impressions: 8460 },
  { week: 'Jul 21', clicks: 478, impressions: 8330 },
  { week: 'Jul 28', clicks: 531, impressions: 8890 },
  { week: 'Aug 4', clicks: 549, impressions: 9140 },
  { week: 'Aug 11', clicks: 522, impressions: 9020 },
  { week: 'Aug 18', clicks: 587, impressions: 9610 },
  { week: 'Aug 25', clicks: 604, impressions: 9880 },
  { week: 'Sep 1', clicks: 641, impressions: 10240 },
  { week: 'Sep 8', clicks: 619, impressions: 10110 },
  { week: 'Sep 15', clicks: 672, impressions: 10690 },
  { week: 'Sep 22', clicks: 704, impressions: 11020 },
]
