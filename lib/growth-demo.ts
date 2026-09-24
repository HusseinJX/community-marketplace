/**
 * Fixture data for the Growth console demo (`/vendor/growth`).
 *
 * ⚠️ NOTHING HERE IS REAL. No ad account is connected, no API is called, no
 * money moves. This module exists so the console can be designed, argued about
 * and shown to a vendor before Google/Meta developer access is approved — the
 * screens are the deliverable, the numbers are scaffolding.
 *
 * Two rules it follows on purpose:
 *
 * 1. **Deterministic.** Every series comes out of a seeded PRNG, never
 *    `Math.random()`. A component that renders different numbers on the server
 *    and the client hydrates with a mismatch, and a demo whose figures shuffle
 *    on every navigation reads as fake within about four seconds.
 *
 * 2. **Plausible, not flattering.** The account loses money in two places on
 *    purpose. A dashboard where every campaign is green has nothing for an
 *    agent to do, which is precisely the thing being demonstrated — so
 *    Performance Max sits at 0.7x and the Meta traffic campaign converts
 *    nothing at all.
 *
 * When the real integrations land, the shapes below (`DayPoint`, `Campaign`,
 * `SearchQuery`, `AgentProposal`) are the seam: swap the generator for an API
 * client and the components don't change.
 */

import { sfToday } from '@/lib/sf-date'

// ── The demo business ────────────────────────────────────────────────────────
// A Sunset District bakery — small enough that the numbers stay legible, real
// enough that a vendor recognises their own account in it.
export const DEMO_BUSINESS = {
  name: 'Sunset Sourdough',
  site: 'sunsetsourdough.com',
  city: 'San Francisco',
} as const

// ── Seeded noise ─────────────────────────────────────────────────────────────
/** mulberry32 — small, fast, and stable across runs. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable integer seed from a string, so each campaign gets its own noise. */
function seedOf(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ── Types ────────────────────────────────────────────────────────────────────
export type ChannelId = 'google_ads' | 'meta_ads' | 'tiktok_ads'

export interface DayPoint {
  /** City-local YYYY-MM-DD (never a UTC slice — see lib/sf-date.ts). */
  date: string
  spendCents: number
  impressions: number
  clicks: number
  conversions: number
  revenueCents: number
}

export interface Campaign {
  id: string
  channel: ChannelId
  name: string
  /** What the platform calls it — shown so the vendor can find it over there. */
  objective: string
  status: 'active' | 'paused' | 'limited'
  dailyBudgetCents: number
  /** Set when status is 'limited' — the share of days the budget capped it. */
  budgetCappedPct?: number
  series: DayPoint[]
}

export const CHANNELS: Record<ChannelId, { label: string; short: string; tint: string; dot: string }> = {
  google_ads: { label: 'Google Ads', short: 'Google', tint: 'bg-blue-50 text-blue-700', dot: '#3b6ef5' },
  meta_ads: { label: 'Meta Ads', short: 'Meta', tint: 'bg-violet-50 text-violet-700', dot: '#8b5cf6' },
  tiktok_ads: { label: 'TikTok Ads', short: 'TikTok', tint: 'bg-stone-100 text-stone-700', dot: '#0f172a' },
}

// ── Campaign definitions ─────────────────────────────────────────────────────
// Each carries the economics it should produce; the generator turns these into
// 90 days of daily rows with weekday seasonality and noise on top.
interface Spec {
  id: string
  channel: ChannelId
  name: string
  objective: string
  status: Campaign['status']
  dailyBudget: number // dollars
  imprPerDay: number
  ctr: number // click-through rate
  cpc: number // dollars
  cvr: number // conversion rate on clicks
  aov: number // dollars per conversion
  /** Multiplier applied across the window — >1 improving, <1 decaying. */
  trend: number
}

const SPECS: Spec[] = [
  {
    id: 'g-brand',
    channel: 'google_ads',
    name: 'Search — Brand',
    objective: 'Search · Manual CPC',
    status: 'active',
    dailyBudget: 8,
    imprPerDay: 40,
    ctr: 0.34,
    cpc: 0.35,
    cvr: 0.08,
    aov: 27,
    trend: 1.04,
  },
  {
    id: 'g-near-me',
    channel: 'google_ads',
    name: 'Search — Sourdough Near Me',
    objective: 'Search · Maximize clicks',
    status: 'active',
    dailyBudget: 20,
    imprPerDay: 130,
    ctr: 0.062,
    cpc: 1.74,
    cvr: 0.11,
    aov: 31,
    trend: 1.01,
  },
  {
    id: 'g-cakes',
    channel: 'google_ads',
    name: 'Search — Custom Cakes',
    objective: 'Search · Maximize conversions',
    status: 'limited',
    dailyBudget: 4,
    imprPerDay: 46,
    ctr: 0.048,
    cpc: 2.1,
    cvr: 0.115,
    aov: 88,
    trend: 1.06,
  },
  {
    id: 'g-pmax',
    channel: 'google_ads',
    name: 'Performance Max — Retail',
    objective: 'Performance Max',
    status: 'active',
    dailyBudget: 9,
    imprPerDay: 1200,
    ctr: 0.011,
    cpc: 0.71,
    cvr: 0.019,
    aov: 26,
    trend: 0.94,
  },
  {
    id: 'm-pastry',
    channel: 'meta_ads',
    name: 'Advantage+ — Weekend Pastry Box',
    objective: 'Sales · Advantage+ shopping',
    status: 'active',
    dailyBudget: 10,
    imprPerDay: 1700,
    ctr: 0.0094,
    cpc: 0.51,
    cvr: 0.039,
    aov: 38,
    trend: 1.03,
  },
  {
    id: 'm-likes',
    channel: 'meta_ads',
    name: 'Traffic — Page Promotion',
    objective: 'Traffic · Landing page views',
    status: 'active',
    dailyBudget: 5,
    imprPerDay: 4100,
    ctr: 0.010,
    cpc: 0.12,
    cvr: 0,
    aov: 0,
    trend: 0.98,
  },
]

const WINDOW_DAYS = 90

/** City-local dates, oldest → newest, ending yesterday (today is partial). */
function windowDates(): string[] {
  const end = new Date(`${sfToday()}T12:00:00Z`)
  const out: string[] = []
  for (let i = WINDOW_DAYS; i >= 1; i--) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Weekend lift. A bakery's Saturday is not its Tuesday, and a chart with no
 * weekly rhythm is the fastest way to look generated.
 */
const DOW_LIFT = [0.86, 0.82, 0.88, 0.95, 1.12, 1.34, 1.18] // Sun → Sat

function buildSeries(spec: Spec, dates: string[]): DayPoint[] {
  const rand = prng(seedOf(spec.id))
  const n = dates.length
  return dates.map((date, i) => {
    // Trend is applied across the whole window, so the earliest day sits at
    // 1/trend of the latest — a gentle slope, not a hockey stick.
    const t = Math.pow(spec.trend, (i / n) * 2 - 1)
    const dow = DOW_LIFT[new Date(`${date}T12:00:00Z`).getUTCDay()]
    const jitter = 0.82 + rand() * 0.36

    const impressions = Math.round(spec.imprPerDay * t * dow * jitter)
    const clicks = Math.max(0, Math.round(impressions * spec.ctr * (0.88 + rand() * 0.24)))
    // Spend is clicks × CPC, then capped by the daily budget — which is what
    // makes a budget-limited campaign actually look limited on the chart.
    const raw = clicks * spec.cpc * (0.92 + rand() * 0.16)
    const spend = Math.min(raw, spec.dailyBudget)
    const billedClicks = raw > 0 ? Math.round(clicks * (spend / raw)) : 0
    const conversions = billedClicks * spec.cvr * (0.7 + rand() * 0.6)
    const revenue = conversions * spec.aov

    return {
      date,
      spendCents: Math.round(spend * 100),
      impressions,
      clicks: billedClicks,
      conversions: Math.round(conversions * 10) / 10,
      revenueCents: Math.round(revenue * 100),
    }
  })
}

let _campaigns: Campaign[] | null = null
export function getCampaigns(): Campaign[] {
  if (_campaigns) return _campaigns
  const dates = windowDates()
  _campaigns = SPECS.map(s => {
    const series = buildSeries(s, dates)
    const budgetCents = Math.round(s.dailyBudget * 100)
    // Derived, never declared. A hand-written "limited 71% of days" beside a
    // table that says otherwise is the same failure as counting intent instead
    // of results — so the badge reads the data it is describing.
    const recent = series.slice(-30)
    const capped = recent.filter(d => d.spendCents >= budgetCents - 2).length
    return {
      id: s.id,
      channel: s.channel,
      name: s.name,
      objective: s.objective,
      status: s.status,
      dailyBudgetCents: budgetCents,
      budgetCappedPct: Math.round((capped / Math.max(1, recent.length)) * 100),
      series,
    }
  })
  return _campaigns
}

// ── Aggregation ──────────────────────────────────────────────────────────────
export interface Totals {
  spendCents: number
  impressions: number
  clicks: number
  conversions: number
  revenueCents: number
}

export const ZERO: Totals = { spendCents: 0, impressions: 0, clicks: 0, conversions: 0, revenueCents: 0 }

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    spendCents: a.spendCents + b.spendCents,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: Math.round((a.conversions + b.conversions) * 10) / 10,
    revenueCents: a.revenueCents + b.revenueCents,
  }
}

/** The last `days` rows of a series (the window ends yesterday). */
export function tail(series: DayPoint[], days: number): DayPoint[] {
  return series.slice(Math.max(0, series.length - days))
}

/** The `days` rows immediately BEFORE the tail — the comparison period. */
export function priorTail(series: DayPoint[], days: number): DayPoint[] {
  const end = Math.max(0, series.length - days)
  return series.slice(Math.max(0, end - days), end)
}

export function totalsOf(rows: DayPoint[]): Totals {
  return rows.reduce(
    (acc, r) => addTotals(acc, r),
    { ...ZERO }
  )
}

export function roas(t: Totals): number {
  return t.spendCents > 0 ? t.revenueCents / t.spendCents : 0
}

export function cpa(t: Totals): number {
  return t.conversions > 0 ? t.spendCents / t.conversions : 0
}

export function cpc(t: Totals): number {
  return t.clicks > 0 ? t.spendCents / t.clicks : 0
}

export function ctr(t: Totals): number {
  return t.impressions > 0 ? t.clicks / t.impressions : 0
}

/** Sum a set of campaigns' series day-by-day into one combined series. */
export function combineSeries(campaigns: Campaign[], days: number): DayPoint[] {
  const parts = campaigns.map(c => tail(c.series, days))
  if (parts.length === 0) return []
  return parts[0].map((_, i) =>
    parts.reduce(
      (acc, p) => ({ ...addTotals(acc, p[i]), date: p[i].date }),
      { ...ZERO, date: parts[0][i].date } as DayPoint
    )
  )
}

// ── Formatting ───────────────────────────────────────────────────────────────
export function money(cents: number, opts: { decimals?: boolean } = {}): string {
  const v = cents / 100
  if (!opts.decimals && Math.abs(v) >= 1000) return `$${Math.round(v).toLocaleString()}`
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })}`
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n).toLocaleString()
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

/** Percent change, or null when there's no base to compare against. */
export function delta(now: number, before: number): number | null {
  if (!before) return null
  return (now - before) / before
}

// ── Connections ──────────────────────────────────────────────────────────────
// The link-and-order path is listed alongside the ad platforms on purpose: it
// is the only row here that produces deterministic revenue rather than the
// platform's own modelled estimate, and the console's whole measurement story
// rests on it. See `ATTRIBUTION_GRADES` below.
export type ConnState = 'connected' | 'attention' | 'available'

export interface Connection {
  id: string
  name: string
  blurb: string
  state: ConnState
  /** What the vendor sees once it's linked — account id, property, etc. */
  account?: string
  lastSync?: string
  /** Shown when state is 'attention' — the thing that needs a human. */
  issue?: string
  /** What we'd ask the platform for. Shown before they click connect. */
  scopes: string[]
  /** True where our own platform access is still in review. */
  pendingReview?: boolean
}

export const CONNECTIONS: Connection[] = [
  {
    id: 'google_ads',
    name: 'Google Ads',
    blurb: 'Campaigns, budgets, keywords and conversions.',
    state: 'connected',
    account: '482-119-3067',
    lastSync: '12 minutes ago',
    scopes: ['Read campaigns & performance', 'Adjust budgets and bids', 'Create and edit ads'],
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    blurb: 'Facebook and Instagram campaigns, audiences and creative.',
    state: 'connected',
    account: 'act_8841027336',
    lastSync: '12 minutes ago',
    scopes: ['ads_read', 'ads_management', 'business_management'],
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    blurb: 'The panel people see when they search your name. Posts, photos, reviews, hours.',
    state: 'connected',
    account: 'Sunset Sourdough · 1841 Irving St',
    lastSync: '1 hour ago',
    scopes: ['Manage listing', 'Post updates', 'Reply to reviews'],
  },
  {
    id: 'search_console',
    name: 'Google Search Console',
    blurb: 'What people search before they land on you, and where you rank for it.',
    state: 'connected',
    account: 'sc-domain:sunsetsourdough.com',
    lastSync: '6 hours ago',
    scopes: ['Read search performance', 'Read index coverage'],
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    blurb: 'What happens on your own site after the click.',
    state: 'attention',
    account: 'GA4 · properties/419820774',
    lastSync: '3 hours ago',
    issue:
      'Connected, but no conversion events are configured — so nothing on your own site is being counted as a result. Until that is fixed, revenue here comes only from orders placed through WhatsLocal.',
    scopes: ['Read reports'],
  },
  {
    id: 'whatslocal',
    name: 'WhatsLocal link tracking',
    blurb:
      'A tagged link on every ad. When the click ends in an order here, we join it to the click in our own database — no pixel, no tracking SDK.',
    state: 'connected',
    account: 'Deterministic · 100% of orders matched',
    lastSync: 'Live',
    scopes: [],
  },
  {
    id: 'tiktok_ads',
    name: 'TikTok Ads',
    blurb: 'Short-form video campaigns.',
    state: 'available',
    scopes: ['Read campaigns & performance', 'Manage campaigns'],
    pendingReview: true,
  },
]

/**
 * How much of the number is actually known.
 *
 * This is the honest part of the product and it belongs on screen, not in a
 * footnote: a vendor who sells here gets arithmetic, a vendor whose landing
 * page we host gets counted leads, and a vendor who only linked their accounts
 * gets whatever their own analytics was already claiming — which, in this demo
 * and in most real ones, is nothing.
 */
export const ATTRIBUTION_GRADES = [
  {
    grade: 'Exact',
    on: true,
    label: 'Orders placed on WhatsLocal',
    detail:
      'The click carries an id we wrote; the order row carries it back. Revenue is joined in our own database — not modelled, not sampled, unaffected by ad blockers or iOS.',
  },
  {
    grade: 'Counted',
    on: true,
    label: 'Leads on landing pages we host',
    detail:
      'Form fills, call taps and booking requests on a campaign page we built. We see the event because it happens on our surface.',
  },
  {
    grade: 'Reported',
    on: false,
    label: 'Everything on your own website',
    detail:
      'Whatever GA4 and the ad platforms say. Right now that is nothing, because no conversion events are configured — fixing that is the first item in the agent queue.',
  },
] as const

// ── The agent queue ──────────────────────────────────────────────────────────
// The queue is the product. Everything else on this screen is a report.
export type ProposalKind = 'budget' | 'pause' | 'keywords' | 'creative' | 'seo' | 'gbp' | 'tracking'
export type ProposalStatus = 'pending' | 'applied' | 'dismissed'

export interface AgentProposal {
  id: string
  kind: ProposalKind
  /** Where it lands, for the channel chip. */
  surface: string
  title: string
  /** Why the agent thinks so — the evidence, in the vendor's language. */
  reason: string
  /** What it expects to happen, and over what period. */
  impact: string
  /** How sure it is, 0–1. Shown, because a confident wrong answer is expensive. */
  confidence: number
  status: ProposalStatus
  /** Set on applied items — when, and whether a human pressed the button. */
  appliedAt?: string
  auto?: boolean
  /** The exact change, rendered as a before → after line. */
  diff?: { before: string; after: string }
}

export const PROPOSALS: AgentProposal[] = [
  {
    id: 'p-tracking',
    kind: 'tracking',
    surface: 'Google Analytics',
    title: 'Fix conversion tracking on sunsetsourdough.com',
    reason:
      'GA4 has been collecting pageviews for 14 months and has never had a conversion event configured. No order, no form fill and no phone tap on your own site has ever been counted — which means every "results" number Google and Meta have shown you was inferred, not measured.',
    impact: 'Makes every other number on this page real. Nothing else here can be trusted until it is done.',
    confidence: 0.98,
    status: 'pending',
    diff: { before: '0 conversion events', after: '4 events: purchase, lead_form, call_tap, directions' },
  },
  {
    id: 'p-budget-cakes',
    kind: 'budget',
    surface: 'Google Ads',
    title: 'Move $6/day from Performance Max to Custom Cakes',
    reason:
      'Performance Max returns about $0.70 for every $1.00. Custom Cakes returns over $5.00 — and it hits its daily budget on most days, so it stops showing while people are still searching. The money is in the wrong campaign.',
    impact: 'Projected +$430–$610 revenue per month at the same total spend.',
    confidence: 0.84,
    status: 'pending',
    diff: { before: 'PMax $9/day · Cakes $4/day', after: 'PMax $3/day · Cakes $10/day' },
  },
  {
    id: 'p-pause-likes',
    kind: 'pause',
    surface: 'Meta Ads',
    title: 'Pause "Traffic — Page Promotion"',
    reason:
      'About $140 a month for roughly 1,100 landing page views, zero tracked conversions and zero attributed orders. It optimises for the click, and the click is not the thing you sell.',
    impact: 'Frees about $140 a month. No measured revenue is at risk.',
    confidence: 0.91,
    status: 'pending',
    diff: { before: 'Active · $5.00/day', after: 'Paused' },
  },
  {
    id: 'p-negatives',
    kind: 'keywords',
    surface: 'Google Ads',
    title: 'Add 7 negative keywords',
    reason:
      '"sourdough starter recipe", "how to make sourdough", "bakery jobs sf" and four others took 148 clicks and about $210 last month and converted nothing. They are people who want to bake, not buy.',
    impact: 'Reclaims roughly $200/month of spend into terms that convert.',
    confidence: 0.93,
    status: 'pending',
    diff: { before: '3 negatives', after: '10 negatives' },
  },
  {
    id: 'p-creative-cakes',
    kind: 'creative',
    surface: 'Google Ads · Creative',
    title: 'Three new headlines for Custom Cakes',
    reason:
      'The current ad has run unchanged for 96 days at 2.1% CTR against a 4.8% benchmark for local bakery search. Drafts are written from your own catalogue — lead times, the $65 starting price and the Irving St pickup.',
    impact: 'A CTR move to benchmark is roughly 2.3× the clicks at the same budget.',
    confidence: 0.62,
    status: 'pending',
  },
  {
    id: 'p-landing-cakes',
    kind: 'seo',
    surface: 'Landing page',
    title: 'Build a landing page for "custom cakes sf"',
    reason:
      'That query put you in front of 6,300 people last month at position 14.2, and you have no page about custom cakes — Google is ranking your homepage for it. A dedicated page serves both the ad and the organic result, and it is a page we host, so the leads are counted.',
    impact: 'Organic: position 14 → single digits is realistic in 6–10 weeks. Paid: a matched page typically lifts conversion rate 30–60%.',
    confidence: 0.71,
    status: 'pending',
  },
  {
    id: 'p-reviews',
    kind: 'gbp',
    surface: 'Business Profile',
    title: 'Reply to 12 unanswered reviews',
    reason:
      'Twelve reviews going back to March have no reply, including two 3-star ones that read as fixable. Replies are drafted in your voice and name the specific thing each person mentioned.',
    impact: 'Reply rate is a ranking input for the local pack, and the two 3-stars are the ones people read.',
    confidence: 0.88,
    status: 'pending',
  },
  {
    id: 'p-meta-desc',
    kind: 'seo',
    surface: 'Website',
    title: 'Write meta descriptions for 3 pages',
    reason:
      'Menu, Classes and Wholesale have none, so Google is writing its own from whatever text it finds first. All three already get impressions.',
    impact: 'Small but free — typically a 5–15% CTR lift on pages that already rank.',
    confidence: 0.79,
    status: 'pending',
  },
  {
    id: 'p-applied-hours',
    kind: 'gbp',
    surface: 'Business Profile',
    title: 'Published holiday hours for Indigenous Peoples’ Day',
    reason: 'Your profile said "open" for a day the shop was closed. Four people had asked for directions that morning.',
    impact: 'Prevented a wasted trip and the one-star that usually follows.',
    confidence: 0.95,
    status: 'applied',
    appliedAt: '6 days ago',
    auto: true,
  },
  {
    id: 'p-applied-budget',
    kind: 'budget',
    surface: 'Google Ads',
    title: 'Raised the Brand search budget to $8/day',
    reason: 'Brand hit its budget every day for a week while returning over 6× — so it was raised in four daily steps, each inside the ±20% limit, without needing you.',
    impact: '+$186 revenue in the 6 days since, at 6× return.',
    confidence: 0.9,
    status: 'applied',
    appliedAt: '9 days ago',
    auto: true,
  },
]

// ── Autonomy ─────────────────────────────────────────────────────────────────
export type Autonomy = 'suggest' | 'guarded' | 'auto'

export const AUTONOMY: { id: Autonomy; label: string; detail: string }[] = [
  {
    id: 'suggest',
    label: 'Suggest only',
    detail: 'Nothing changes in your ad accounts until you press approve. Every time.',
  },
  {
    id: 'guarded',
    label: 'Act within limits',
    detail:
      'Small, reversible changes apply on their own — budget moves inside the guardrails below. Pausing a campaign, spending more overall, and anything creative still waits for you.',
  },
  {
    id: 'auto',
    label: 'Run it',
    detail:
      'The agent manages campaigns to the monthly cap and tells you what it did. You keep the cap, the kill switch and the log.',
  },
]

export const GUARDRAILS = [
  { id: 'budget-step', label: 'Largest budget change without asking', value: '±20% per campaign per day' },
  { id: 'monthly-cap', label: 'Monthly spend ceiling', value: '$1,500 across all channels' },
  { id: 'pause', label: 'Pausing a campaign', value: 'Always asks first' },
  { id: 'new-campaign', label: 'Creating a new campaign', value: 'Always asks first' },
  { id: 'creative', label: 'Publishing new ad copy or images', value: 'Always asks first' },
]
