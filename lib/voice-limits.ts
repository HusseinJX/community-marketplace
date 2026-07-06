import { createClient } from '@supabase/supabase-js'

// Daily per-business cap on browser voice calls (Realtime is billed per minute).
// The number lives here (not the DB) so a subscription tier can override it
// later. Env-overridable for quick tuning without a deploy. See migration
// 20260706120000_voice_call_usage.

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

export interface VoiceQuota {
  allowed: boolean
  /** 'month' = plan quota hit; 'day' = safety cap hit. */
  reason?: 'month' | 'day'
  usedToday: number
  usedMonth: number
  monthlyLimit: number
}

/**
 * Check-and-reserve one voice call for `memberId`, enforcing both the monthly
 * plan quota and a daily safety cap. Returns allowed=false (without
 * incrementing) when either is exceeded. Fails open on DB error so a transient
 * Supabase blip never blocks a call — the client length cap still bounds cost.
 */
export async function reserveVoiceCall(
  memberId: string,
  monthlyLimit: number,
  dailyLimit: number
): Promise<VoiceQuota> {
  const day = today()
  try {
    // Month-to-date usage across daily buckets.
    const { data: monthRows } = await supabase
      .from('voice_call_usage')
      .select('day, count')
      .eq('member_id', memberId)
      .like('day', `${thisMonthPrefix()}%`)

    const rows = (monthRows as { day: string; count: number }[] | null) ?? []
    const usedMonth = rows.reduce((sum, r) => sum + r.count, 0)
    const usedToday = rows.find((r) => r.day === day)?.count ?? 0

    if (usedMonth >= monthlyLimit) {
      return { allowed: false, reason: 'month', usedToday, usedMonth, monthlyLimit }
    }
    if (usedToday >= dailyLimit) {
      return { allowed: false, reason: 'day', usedToday, usedMonth, monthlyLimit }
    }

    await supabase
      .from('voice_call_usage')
      .upsert(
        { member_id: memberId, day, count: usedToday + 1, updated_at: new Date().toISOString() },
        { onConflict: 'member_id,day' }
      )
    return { allowed: true, usedToday: usedToday + 1, usedMonth: usedMonth + 1, monthlyLimit }
  } catch {
    // Fail open — don't let a DB hiccup block calls; the length cap bounds cost.
    return { allowed: true, usedToday: 0, usedMonth: 0, monthlyLimit }
  }
}
