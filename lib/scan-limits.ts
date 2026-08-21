import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEntitlements, PLANS } from './entitlements'

// Per-business cap on photo→drafts scanning: "Scan menu" and flyer capture
// (app/api/ai/extract) and counter/shelf detection (app/api/ai/detect-products).
// Each is a full-resolution photo sent to the vision model — billable on its
// own, independently of whether anything is generated afterwards. See migration
// 20260813150000.
//
// Both routes share one allowance because they're one capability to a vendor
// ("photograph it, get drafts") and identical in cost shape. Splitting them
// would just be two ceilings to reason about.
//
// The numbers live in lib/entitlements.ts (Limits.photoScansPerMonth /
// photoScansPerDay) so a tier re-cut needs no schema change.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}
function thisMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

export interface ScanQuota {
  allowed: boolean
  /** 'month' = plan quota hit; 'day' = burst cap hit; 'error' = couldn't count. */
  reason?: 'month' | 'day' | 'error'
  usedToday: number
  usedMonth: number
  monthlyLimit: number
}

/**
 * Check-and-reserve one menu scan, enforcing a monthly plan quota and a daily
 * burst cap. Reserving BEFORE the work is the point: the old accounting only
 * incremented on a successful image generation, so a scan whose generations all
 * failed cost money and counted for nothing.
 *
 * Unlike reserveVoiceCall this fails CLOSED. A voice call is bounded by its own
 * length cap, but a scan loop is not bounded by anything else, and a refused
 * scan is a retry while an uncounted one is an open tab.
 */
export async function reservePhotoScan(
  memberId: string,
  monthlyLimit: number,
  dailyLimit: number
): Promise<ScanQuota> {
  const day = today()
  if (monthlyLimit <= 0 || dailyLimit <= 0) {
    return { allowed: false, reason: 'month', usedToday: 0, usedMonth: 0, monthlyLimit }
  }

  try {
    const { data: monthRows, error } = await supabase
      .from('photo_scan_usage')
      .select('day, count')
      .eq('member_id', memberId)
      .like('day', `${thisMonthPrefix()}%`)
    if (error) throw new Error(error.message)

    const rows = (monthRows as { day: string; count: number }[] | null) ?? []
    const usedMonth = rows.reduce((sum, r) => sum + r.count, 0)
    const usedToday = rows.find((r) => r.day === day)?.count ?? 0

    if (usedMonth >= monthlyLimit) {
      return { allowed: false, reason: 'month', usedToday, usedMonth, monthlyLimit }
    }
    if (usedToday >= dailyLimit) {
      return { allowed: false, reason: 'day', usedToday, usedMonth, monthlyLimit }
    }

    const { error: writeError } = await supabase
      .from('photo_scan_usage')
      .upsert(
        { member_id: memberId, day, count: usedToday + 1, updated_at: new Date().toISOString() },
        { onConflict: 'member_id,day' }
      )
    if (writeError) throw new Error(writeError.message)

    return { allowed: true, usedToday: usedToday + 1, usedMonth: usedMonth + 1, monthlyLimit }
  } catch (e) {
    console.error('photo scan quota check failed:', e)
    return { allowed: false, reason: 'error', usedToday: 0, usedMonth: 0, monthlyLimit }
  }
}

/**
 * Route-level gate: reserves one scan and returns the response to send back, or
 * null to proceed. Mirrors gateCapability(), so a route reads the same either
 * way. Call it AFTER the capability gate — a member who can't use the feature
 * shouldn't burn allowance discovering that.
 */
export async function gatePhotoScan(
  memberId: string,
  opts: { bypass?: boolean } = {}
): Promise<NextResponse | null> {
  if (opts.bypass) return null

  const ent = await getEntitlements(memberId)
  const scan = await reservePhotoScan(memberId, ent.limits.photoScansPerMonth, ent.limits.photoScansPerDay)
  if (scan.allowed) return null

  if (scan.reason === 'error') {
    return NextResponse.json(
      { error: "Couldn't check your scan allowance — try again shortly." },
      { status: 503 }
    )
  }

  // "Upgrade" is only honest advice when a higher tier actually grants more.
  const canUpgrade = ent.limits.photoScansPerMonth <= PLANS.free.limits.photoScansPerMonth

  return NextResponse.json(
    {
      error:
        scan.reason === 'day'
          ? 'Daily scan limit reached — try again tomorrow.'
          : canUpgrade
            ? `You've used your ${scan.monthlyLimit} scans this month. Upgrade to Pro for more.`
            : `You've used all ${scan.monthlyLimit} scans this month. They reset at the start of next month.`,
      scanLimit: true,
      upgradeRequired: scan.reason === 'month' && canUpgrade,
    },
    { status: scan.reason === 'day' ? 429 : 402 }
  )
}
