import { createClient } from '@supabase/supabase-js'

// AI product-image generation is a premium feature. Every business gets a few
// free generations; past that they must upgrade. A rolling hourly window also
// caps cost/abuse for premium members. See migration 20260628200000.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

/** Free AI images per business, lifetime, before an upgrade is required. */
export const FREE_IMAGE_LIMIT = 3
/** Max AI images generated in a single scan (bounds per-request cost). */
export const PER_REQUEST_CAP = 3
/** Rolling-window rate limit for premium members (per day). */
export const RATE_LIMIT_PER_DAY = 10
const WINDOW_MS = 24 * 60 * 60 * 1000

interface CreditsRow {
  member_id: string
  generated_count: number
  premium: boolean
  window_start: string | null
  window_count: number
}

const EMPTY = (memberId: string): CreditsRow => ({
  member_id: memberId,
  generated_count: 0,
  premium: false,
  window_start: null,
  window_count: 0,
})

async function fetchCredits(memberId: string): Promise<CreditsRow> {
  const { data } = await supabase.from('ai_image_credits').select('*').eq('member_id', memberId).single()
  return (data as CreditsRow) ?? EMPTY(memberId)
}

// How many generations are still allowed inside the current rolling window.
function windowState(row: CreditsRow, now: number): { count: number; expired: boolean } {
  const start = row.window_start ? new Date(row.window_start).getTime() : 0
  const expired = !start || now - start >= WINDOW_MS
  return { count: expired ? 0 : row.window_count, expired }
}

export interface QuotaDecision {
  allowed: number // images that may be generated this request (0 = blocked)
  premium: boolean
  remainingFree: number
  blocked: null | 'upgrade' | 'rate_limited'
}

// Decide how many AI images this member may generate right now. Admins bypass
// all limits. Free members are capped at FREE_IMAGE_LIMIT lifetime; premium
// members are capped at RATE_LIMIT_PER_HOUR per rolling hour. Both are further
// bounded to PER_REQUEST_CAP per scan.
export async function checkImageQuota(memberId: string, isAdmin: boolean): Promise<QuotaDecision> {
  if (isAdmin) {
    return { allowed: PER_REQUEST_CAP, premium: true, remainingFree: Number.POSITIVE_INFINITY, blocked: null }
  }

  const row = await fetchCredits(memberId)
  const { count: windowCount } = windowState(row, Date.now())

  if (row.premium) {
    const remainingToday = RATE_LIMIT_PER_DAY - windowCount
    if (remainingToday <= 0) return { allowed: 0, premium: true, remainingFree: Number.POSITIVE_INFINITY, blocked: 'rate_limited' }
    return { allowed: Math.min(PER_REQUEST_CAP, remainingToday), premium: true, remainingFree: Number.POSITIVE_INFINITY, blocked: null }
  }

  const remainingFree = Math.max(0, FREE_IMAGE_LIMIT - row.generated_count)
  if (remainingFree <= 0) return { allowed: 0, premium: false, remainingFree: 0, blocked: 'upgrade' }
  return { allowed: Math.min(PER_REQUEST_CAP, remainingFree), premium: false, remainingFree, blocked: null }
}

// Record that `n` images were actually generated — advances the lifetime count
// and the rolling window. Best-effort (non-transactional); skips when n <= 0 or
// for admins (memberId is the acted-on member, so admin generations still count
// toward that member if you want them to — pass isAdmin to checkImageQuota only).
export async function recordImageGenerations(memberId: string, n: number): Promise<void> {
  if (n <= 0) return
  const now = Date.now()
  const row = await fetchCredits(memberId)
  const { expired } = windowState(row, now)
  const nextRow = {
    member_id: memberId,
    generated_count: row.generated_count + n,
    premium: row.premium,
    window_start: expired ? new Date(now).toISOString() : row.window_start ?? new Date(now).toISOString(),
    window_count: (expired ? 0 : row.window_count) + n,
    updated_at: new Date(now).toISOString(),
  }
  await supabase.from('ai_image_credits').upsert(nextRow, { onConflict: 'member_id' })
}
