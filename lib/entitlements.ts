import { createClient } from '@supabase/supabase-js'
import { isDemoMode } from '@/lib/demo-admin'
import { getDemoMember } from '@/lib/demo-members'

// The single source of truth for what each subscription plan unlocks. Plans
// (the "re-cut": payment follows proof, supply/liquidity isn't taxed):
//   free  Participate — claimed/verified/network-visible profile, posts, discovery,
//                RECEIVING collab/event invites (join events + lineups), AND
//                COMMERCE (shop/menu/catalog/Stripe/delivery). Don't tax being in
//                the network, and don't tax selling — the 5% on sales is the
//                platform's cut, so we earn when the vendor earns.
//   member $10 Act   — everything free + SENDING invites + the "For You" matcher,
//                creating/organizing events + lineups, lead/RSVP inbox, and
//                SMS/email blasts. The organizer tier.
//   pro   $30 Capture — everything above + the text AI customer-service agent,
//                the VOICE agent (metered), and analytics. The "run on the
//                network" tier. Selling is NOT what you buy here — the robot is.
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
  /**
   * "Scan menu" photo→catalog runs per month. Metered separately from the images
   * it produces: a scan is a full-resolution vision call whether or not anything
   * is generated afterwards, so the generation counter never saw it.
   */
  photoScansPerMonth: number
  /** Burst cap regardless of the monthly quota. */
  photoScansPerDay: number
  /**
   * Max active products (Infinity = unlimited).
   *
   * ⚠️ NOTHING READS THIS TODAY — it is a declared intent, not a live cap. It
   * was 0 for free/member back when commerce itself was gated; now that selling
   * is free the number matters, so wire it into the products write path before
   * quoting it to anyone.
   */
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

// Free (Participate): claimed profile, posts, discovery, RECEIVING invites —
// and, since 2026-08-14, COMMERCE. Joining the network, being available to
// collaborate, and selling are all free.
//
// Selling moved here because a subscription in front of a vendor's first sale
// taxes supply in a market that is supply-constrained: $30/mo × the vendors who
// won't pay it is $0, while 5% of the sales they do make is not. The platform
// now earns when the vendor earns. Pro is no longer "you may sell" — it's the AI
// agent (text + voice) and analytics.
const FREE_CAN: Record<Capability, boolean> = {
  ...NONE,
  claimedProfile: true,
  posts: true,
  discovery: true,
  networkReceive: true,
  commerce: true,
}

// Member ($10, Act/Organize): everything free + SENDING collab invites, the
// "For You" matcher, creating/organizing events + lineups, the lead/RSVP inbox,
// and blasts. NO AI agent, voice, or commerce — those are the $30 tools.
const MEMBER_CAN: Record<Capability, boolean> = {
  ...FREE_CAN,
  networkInitiate: true,
  organizeEvents: true,
  captureLeads: true,
  automations: true,
}

// Pro ($30): everything above + what Pro is now actually about — the AI AGENT
// (text + voice) and analytics. Commerce used to live here; it's free as of
// 2026-08-14 (see FREE_CAN). `commerce` is inherited, not re-granted.
const PRO_CAN: Record<Capability, boolean> = {
  ...MEMBER_CAN,
  textAssistant: true,
  voiceAssistant: true,
  analytics: true,
}

export const PLANS: Record<Plan, { can: Record<Capability, boolean>; limits: Limits }> = {
  // Scans are allowed below Pro but kept to a taste: enough to photograph a menu
  // and see what the feature does, not enough to run a catalog on. The daily cap
  // is what actually bounds a runaway client — a loop can't spend a month's
  // worth in an afternoon.
  free: {
    can: FREE_CAN,
    limits: { voiceCallsPerMonth: 0, voiceCallsPerDay: 0, aiImagesPerMonth: 0, photoScansPerMonth: 3, photoScansPerDay: 2, productLimit: 50 },
  },
  member: {
    can: MEMBER_CAN,
    limits: { voiceCallsPerMonth: 0, voiceCallsPerDay: 0, aiImagesPerMonth: 0, photoScansPerMonth: 3, photoScansPerDay: 2, productLimit: 50 },
  },
  pro: {
    can: PRO_CAN,
    // ~40 calls/mo × 5-min cap ≈ 200 min ceiling — comfortably covered by $30.
    // Pro is capped too, not unlimited: a paid plan is not a blank cheque
    // against gpt-image-1, and 60/mo is far past what stocking a real shop takes.
    limits: { voiceCallsPerMonth: 40, voiceCallsPerDay: 15, aiImagesPerMonth: 100, photoScansPerMonth: 60, photoScansPerDay: 10, productLimit: Infinity },
  },
  enterprise: {
    can: PRO_CAN,
    limits: { voiceCallsPerMonth: 200, voiceCallsPerDay: 50, aiImagesPerMonth: 1000, photoScansPerMonth: 300, photoScansPerDay: 30, productLimit: Infinity },
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
