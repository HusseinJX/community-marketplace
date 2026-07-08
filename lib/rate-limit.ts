import { NextResponse } from 'next/server'

// Lightweight in-memory sliding-window rate limiter.
//
// The marketplace runs as a PERSISTENT Next.js server on CapRover (not
// serverless functions), so process memory survives across requests — making an
// in-memory limiter genuinely effective for abuse / DoS / SMS-cost protection at
// launch scale. Caveat: if the app is scaled to instanceCount > 1, limits become
// per-instance; swap this for a shared store (Supabase/Redis) at that point.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = 0

// Bound memory: drop expired buckets at most once a minute.
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k)
}

/** Record a hit for `key`; returns whether it's allowed + seconds until reset. */
export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  sweep(now)
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  b.count++
  return { ok: true, retryAfter: 0 }
}

/** Best-effort client IP from proxy headers (CapRover / Cloudflare set these). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Rate-limit guard for an API route. Returns a 429 NextResponse to return
 * immediately when over the limit, or null to proceed.
 *
 *   const limited = rateLimit({ req, name: 'otp', id: userId, limit: 5, windowMs: 600_000 })
 *   if (limited) return limited
 */
export function rateLimit(opts: {
  req: Request
  name: string
  id?: string | null
  limit: number
  windowMs: number
  /** also enforce a per-IP cap (defaults to 3× the id limit) */
  ipLimit?: number
}): NextResponse | null {
  const { req, name, id, limit, windowMs } = opts
  const ip = clientIp(req)
  const ipLimit = opts.ipLimit ?? limit * 3

  // Per-identity (user/member) limit — the primary guard.
  if (id) {
    const r = hit(`${name}:id:${id}`, limit, windowMs)
    if (!r.ok) return over(r.retryAfter)
  }
  // Per-IP backstop (covers anon + many-accounts-one-IP abuse).
  const rip = hit(`${name}:ip:${ip}`, ipLimit, windowMs)
  if (!rip.ok) return over(rip.retryAfter)

  return null
}

function over(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: 'rate_limited', message: 'Too many requests. Please slow down.', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
