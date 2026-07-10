import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { researchMember } from '@/lib/api'
import { buildInterviewBrief, type BriefInput } from '@/lib/onboard'
import { isDemoMode } from '@/lib/demo-admin'

export const runtime = 'nodejs'

// POST { memberId, seed? } — build a "what we already know" brief to WARM the
// /join onboarding interview so the agent opens already knowing the business.
// `seed` is the instant, zero-latency baseline the client already has (from the
// Google Places pick); we merge a best-effort connector web-search research pass
// on top when it returns in time. Always resolves with a usable brief — a slow
// or failed research pass just falls back to the seed. Never blocks the flow.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const memberId = String(body.memberId ?? '').trim()
  const seed = (body.seed ?? {}) as BriefInput
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  let research: string | null = null
  let enriched: Partial<BriefInput> = {}
  try {
    const r = await researchMember(memberId)
    research = r.research
    // The connector may have richer structured fields than the client seed.
    if (r.profile) {
      const p = r.profile as Record<string, unknown>
      enriched = {
        category: (p.category as string) ?? undefined,
        subcategory: (p.subcategory as string) ?? undefined,
        description: (p.businessDescription as string) ?? undefined,
        products: (p.products as string[]) ?? undefined,
        services: (p.services as string[]) ?? undefined,
      }
    }
  } catch {
    // Best-effort — fall back to whatever the client seeded.
  }

  const brief = buildInterviewBrief({
    ...seed,
    category: seed.category ?? enriched.category ?? null,
    subcategory: seed.subcategory ?? enriched.subcategory ?? null,
    description: seed.description ?? enriched.description ?? null,
    products: seed.products ?? enriched.products ?? null,
    services: seed.services ?? enriched.services ?? null,
    research,
  })

  return NextResponse.json({ brief, hasResearch: Boolean(research) })
}
