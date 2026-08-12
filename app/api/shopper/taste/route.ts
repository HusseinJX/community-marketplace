// The shopper's saved taste profile: read it, change it, delete it.
//
// Public and account-optional, like the feed it feeds. A signed-out visitor
// carries their own `device:…` id; signing in switches to the Clerk id, and a
// client-supplied id is ignored from then on (see `subjectFor`).

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rateLimit } from '@/lib/rate-limit'
import { subjectFor, getTaste, saveTaste, clearTaste, tasteConfigured } from '@/lib/reco/taste'
import { INTERESTS } from '@/lib/reco/profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolve(req: Request, supplied?: string | null) {
  const { userId } = await auth().catch(() => ({ userId: null }) as { userId: string | null })
  const url = new URL(req.url)
  return subjectFor(userId ?? null, supplied ?? url.searchParams.get('id'))
}

/** The vocabulary rides along so the client never hard-codes a second copy. */
const CATALOG = INTERESTS.map((i) => ({ id: i.id, label: i.label, emoji: i.emoji }))

export async function GET(req: Request) {
  const subject = await resolve(req)
  if (!subject) return NextResponse.json({ taste: null, interests: CATALOG })
  if (!tasteConfigured()) return NextResponse.json({ taste: null, interests: CATALOG })

  const taste = await getTaste(subject).catch(() => null)
  return NextResponse.json({ taste, interests: CATALOG })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}))
  const subject = await resolve(req, body.id)
  if (!subject) return NextResponse.json({ error: 'No profile id' }, { status: 400 })

  // Each save may cost one embedding, so it is capped per identity.
  const limited = rateLimit({ req, name: 'shopper-taste', id: subject, limit: 30, windowMs: 60_000 })
  if (limited) return limited

  if (!tasteConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  try {
    const taste = await saveTaste(subject, {
      interests: Array.isArray(body.interests) ? body.interests.map(String) : undefined,
      about: body.about === undefined ? undefined : body.about === null ? null : String(body.about),
    })
    if (!taste) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
    return NextResponse.json({ taste })
  } catch (e) {
    console.error('[shopper/taste] save failed', e)
    return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }
}

/**
 * "Remember this" — fold a one-off search into the saved profile.
 *
 * A separate verb from PUT because the merge has to happen where the existing
 * text is. Doing it in the browser would mean the feed had to hold a copy of
 * the profile it is only supposed to be ranked by, and two writers racing on
 * one paragraph is how "Remember this" quietly erases what someone typed on
 * the /shopper screen a minute earlier.
 *
 * Appending rather than replacing is the point: the sentence is an addition to
 * who they are, not a new definition of it.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const subject = await resolve(req, body.id)
  if (!subject) return NextResponse.json({ error: 'No profile id' }, { status: 400 })

  const limited = rateLimit({ req, name: 'taste-remember', id: subject, limit: 20, windowMs: 60_000 })
  if (limited) return limited
  if (!tasteConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const line = String(body.text ?? '').trim().slice(0, 200)
  if (!line) return NextResponse.json({ error: 'Nothing to remember' }, { status: 400 })

  try {
    const current = await getTaste(subject)
    const existing = (current?.about ?? '').trim()
    // Already there — saying it twice would double its weight in the embedding
    // for no reason, and the button should be idempotent.
    if (existing.toLowerCase().includes(line.toLowerCase())) {
      return NextResponse.json({ taste: current, added: false })
    }
    const merged = existing ? `${existing.replace(/[.\s]*$/, '')}. ${line}` : line
    const taste = await saveTaste(subject, { about: merged.slice(0, 2000) })
    return NextResponse.json({ taste, added: true })
  } catch (e) {
    console.error('[shopper/taste] remember failed', e)
    return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const subject = await resolve(req, body.id)
  if (!subject) return NextResponse.json({ error: 'No profile id' }, { status: 400 })

  const limited = rateLimit({ req, name: 'shopper-taste-del', id: subject, limit: 10, windowMs: 60_000 })
  if (limited) return limited

  await clearTaste(subject).catch(() => {})
  return NextResponse.json({ taste: null })
}
