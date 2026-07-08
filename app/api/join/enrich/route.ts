import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { onboardFromMessages } from '@/lib/api'
import { isDemoMode } from '@/lib/demo-admin'

export const runtime = 'nodejs'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

// POST { memberId, messages } — enrich an EXISTING member from the /join
// onboarding interview transcript (voice or text). The member was already
// created + verified in /join, so we DON'T create a new one. We hand the whole
// conversation to the connector's own profiling brain (marketplace-onboard with
// a memberId → enrich-in-place) — the SAME full brain SMS/web/booth/Telnyx
// onboarding uses: ~45-field schema, price normalization, postSave enrichment
// (website/Places/IG/story) and fresh Pinecone vectors. The connector protects
// the verified anchors (name, contact, location, claim status) from being
// overwritten by the interview.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const memberId = String(body.memberId ?? '').trim()
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-40) : []
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // If nothing meaningful was said, treat as a graceful skip — not an error.
  const said = messages
    .filter((m) => m && m.role === 'user' && String(m.content ?? '').trim())
    .map((m) => String(m.content).trim())
    .join(' ')
  if (said.length < 15) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    await onboardFromMessages(messages, { memberId, source: 'join_interview' })
  } catch (e) {
    console.error('[join/enrich] onboard-in-place failed', e)
    return NextResponse.json({ error: 'Could not save — try again' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
