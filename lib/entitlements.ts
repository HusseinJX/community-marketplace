import { createClient } from '@supabase/supabase-js'
import { isDemoMode } from '@/lib/demo-admin'

// The single source of truth for what each subscription plan unlocks. Plans:
//   free       — unclaimed directory listing only (no editing, no tools)
//   member $10 — claimed/verified/network-visible profile + text AI agent, posts,
//                discovery, and RECEIVING collab/event opportunities
//   pro   $30  — everything + commerce (shop/menu/catalog), CREATING invites,
//                organizing events, lead capture, analytics, automations, and the
//                VOICE agent (metered)
//   enterprise — Pro + higher limits, granted manually (contact sales)
//
// Capabilities + numeric limits live here (not the DB) so they can change without
// a migration. Routes gate on getEntitlements(memberId).

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

export type Plan = 'free' | 'member' | 'pro' | 'enterprise'

export type Capability =
  | 'claimedProfile' // verified, network-visible, editable profile
  | 'textAssistant' // the text customer-service agent
  | 'posts'
  | 'discovery' // surfaced in search + ecosystem recommendations
  | 'networkReceive' // can receive collab/event invites
  | 'commerce' // connect shop / menu / catalog, sell, sync
  | 'voiceAssistant' // browser voice call to the AI agent
  | 'organizeEvents' // create + organize events, run lineups
  | 'networkInitiate' // send collab invites
  | 'captureLeads' // leads / RSVPs / inquiries inbox
  | 'analytics'
  | 'automations' // SMS / email blasts, follow-ups

export interface Limits {
  /** Voice calls the business's agent will answer per month (0 = none). */
  voiceCallsPerMonth: number
  /** Safety cap regardless of plan quota. */
  voiceCallsPerDay: number
  /** AI product images per month (drives ai_image_credits premium behavior). */
  aiImagesPerMonth: number
  /** Max active products (Infinity = unlimited). */
  productLimit: number
}

export interface Entitlements {
  plan: Plan
  active: boolean
  can: Record<Capability, boolean>
  limits: Limits
}

const NONE: Record<Capability, boolean> = {
  claimedProfile: false,
  textAssistant: false,
  posts: false,
  discovery: false,
  networkReceive: false,
  commerce: false,
  voiceAssistant: false,
  organizeEvents: false,
  networkInitiate: false,
  captureLeads: false,
  analytics: false,
  automations: false,
}

// Free: post to the community, be discoverable, use community support/resources.
// No AI agent, no invites — those start at Member.
const FREE_CAN: Record<Capability, boolean> = {
  ...NONE,
  posts: true,
  discovery: true,
}

// Member ($10): everything free + the text AI agent + RECEIVING collab/event invites.
const MEMBER_CAN: Record<Capability, boolean> = {
  ...FREE_CAN,
  claimedProfile: true,
  textAssistant: true,
  networkReceive: true,
}

const PRO_CAN: Record<Capability, boolean> = {
  claimedProfile: true,
  textAssistant: true,
  posts: true,
  discovery: true,
  networkReceive: true,
  commerce: true,
  voiceAssistant: true,
  organizeEvents: true,
  networkInitiate: true,
  captureLeads: true,
  analytics: true,
  automations: true,
}

export const PLANS: Record<Plan, { can: Record<Capability, boolean>; limits: Limits }> = {
  free: { can: FREE_CAN, limits: { voiceCallsPerMonth: 0, voiceCallsPerDay: 0, aiImagesPerMonth: 0, productLimit: 0 } },
  member: {
    can: MEMBER_CAN,
    limits: { voiceCallsPerMonth: 0, voiceCallsPerDay: 0, aiImagesPerMonth: 0, productLimit: 0 },
  },
  pro: {
    can: PRO_CAN,
    // ~40 calls/mo × 5-min cap ≈ 200 min ceiling — comfortably covered by $30.
    limits: { voiceCallsPerMonth: 40, voiceCallsPerDay: 15, aiImagesPerMonth: 100, productLimit: Infinity },
  },
  enterprise: {
    can: PRO_CAN,
    limits: { voiceCallsPerMonth: 200, voiceCallsPerDay: 50, aiImagesPerMonth: 1000, productLimit: Infinity },
  },
}

// Display metadata for the pricing UI. priceEnv points at the Stripe Price id env
// var; enterprise has none (contact sales).
export const PLAN_META: Record<
  Plan,
  { label: string; price: string; tagline: string; priceEnv?: string; selfServe: boolean }
> = {
  free: { label: 'Free Listing', price: '$0', tagline: 'Be found. Not fully claimed.', selfServe: false },
  member: { label: 'Member', price: '$10/mo', tagline: 'Join the network.', priceEnv: 'STRIPE_PRICE_MEMBER', selfServe: true },
  pro: { label: 'Pro / Organizer', price: '$30/mo', tagline: 'Activate the network.', priceEnv: 'STRIPE_PRICE_PRO', selfServe: true },
  enterprise: { label: 'Organizations', price: 'Contact sales', tagline: 'Power collective impact.', selfServe: false },
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

interface SubRow {
  plan: Plan
  status: string
}

/** Resolve a member's live entitlements from their subscription row. */
export async function getEntitlements(memberId: string): Promise<Entitlements> {
  // Demo/testing deploy: everything is Pro so every feature is testable without
  // a real subscription. NEXT_PUBLIC_DEMO_MODE must be off in production.
  if (isDemoMode()) {
    return { plan: 'pro', active: true, can: PLANS.pro.can, limits: PLANS.pro.limits }
  }

  let plan: Plan = 'free'
  let active = false
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('member_id', memberId)
      .single()
    const row = data as SubRow | null
    if (row && ACTIVE_STATUSES.has(row.status) && row.plan in PLANS) {
      plan = row.plan
      active = true
    }
  } catch {
    /* no row / DB blip → free */
  }

  const def = PLANS[plan]
  return { plan, active, can: def.can, limits: def.limits }
}

/** Convenience: does this member have a capability right now? */
export async function can(memberId: string, cap: Capability): Promise<boolean> {
  const ent = await getEntitlements(memberId)
  return ent.can[cap]
}
