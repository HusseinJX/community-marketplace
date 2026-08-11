import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSavedEventIds, saveEvent, unsaveEvent } from '@/lib/saved-events'

// The star on an event card. GET returns the whole id list in one request
// rather than a per-card lookup — a feed renders 60 cards, and 60 round trips
// to answer "is this starred?" is 60 round trips too many. The client holds it
// as a set (see useSavedEvents in lib/data-hooks).

export async function GET() {
  const { userId } = await auth()
  // Signed out isn't an error here — it's an empty list. The card still renders.
  if (!userId) return NextResponse.json({ eventIds: [] })
  try {
    return NextResponse.json({ eventIds: await getSavedEventIds(userId) })
  } catch {
    return NextResponse.json({ eventIds: [] })
  }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to save events' }, { status: 401 })
  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: string }
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  try {
    await saveEvent(userId, eventId)
    return NextResponse.json({ saved: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: string }
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  try {
    await unsaveEvent(userId, eventId)
    return NextResponse.json({ saved: false })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
