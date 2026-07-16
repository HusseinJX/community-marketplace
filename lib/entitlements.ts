import { createClient } from '@supabase/supabase-js'
import { isDemoMode } from '@/lib/demo-admin'
import { getDemoMember } from '@/lib/demo-members'

// The single source of truth for what each subscription plan unlocks. Plans
// (the "re-cut": payment follows proof, supply/liquidity isn't taxed):
//   free  Participate — claimed/verified/network-visible profile, posts, discovery,
//                and RECEIVING collab/event invites (join events + lineups). Don't
//                tax being in the network.
//   member $10 Act   — everything free + SENDING invites + the "For You" matcher,
//                creating/organizing events + lineups, lead/RSVP inbox, and
//                SMS/email blasts. The organizer tier.
//   pro   $30 Capture — everything above + the text AI customer-service agent,
//                the VOICE agent (metered), commerce (shop/menu/catalog/Stripe/Uber),
//                and analytics. The "run on the network" tier.
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

// Free (Participate): claimed profile, posts, discovery, and RECEIVING invites —
// joining the network and being available to collaborate is free. No AI agent,
// no SENDING invites/organizing — those start at Member.
const FREE_CAN: Record<Capability, boolean> = {
  ...NONE,
  claimedProfile: true,
  posts: true,
  discovery: true,
  networkReceive: true,
}

// Member ($10, Act/Organize): everything free + SENDING invites + the "For You"
// matcher, creating/organizing events + lineups, the lead/RSVP inbox, and blasts.
// Still NO AI agent/voice/commerce — those are the $30 capture tools.
const MEMBER_CAN: Record<Capability, boolean> = {
  ...FREE_CAN,
  networkInitiate: true,
  organizeEvents: true,
  captureLeads: true,
  automations: true,
}

// Pro ($30, Capture/Run on it): everything above + the text AI agent, voice agent,
// commerce, and analytics.
const PRO_CAN: Record<Capability, boolean> = {
  ...MEMBER_CAN,
  textAssistant: true,
  voiceAssistant: true,
  commerce: true,
  analytics: true,
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
  free: { label: 'Participate', price: '$0', tagline: 'Get in the network.', selfServe: false },
  member: { label: 'Organizer', price: '$10/mo', tagline: 'Act — send invites & host events.', priceEnv: 'STRIPE_PRICE_MEMBER', selfServe: true },
  pro: { label: 'Pro', price: '$30/mo', tagline: 'Capture — run on the network.', priceEnv: 'STRIPE_PRICE_PRO', selfServe: true },
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
  // Demo members (the Admin demo accounts) are always Pro too — so the demo
  // account has the full toolkit, including its customer-service AI.
  if (isDemoMode() || getDemoMember(memberId)) {
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
