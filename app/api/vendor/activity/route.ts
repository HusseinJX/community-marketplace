import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getRoomActivity } from '@/lib/collab-network'
import { getCustomerMessageActivity } from '@/lib/vendor-connect'

// Message activity for the acting member, in the shape an unread badge needs:
// per collaboration room and per customer conversation, every message reduced to
// { key, at, mine }. The CLIENT owns "last seen" (localStorage, per device) and
// counts anything newer that isn't theirs — so no read-state table is needed.
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Demo: the collab rooms are client-side fixtures, so seed matching activity —
  // otherwise the badges are invisible in the demo. Customer DMs still read the
  // real store (same source the Customers tab lists), so those badges stay honest.
  //
  // Timestamps are relative to NOW, not hardcoded: "mark as seen" stamps the
  // current time, so a fixed future date would leave messages permanently unread.
  if (actor.isDemo) {
    const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
    return NextResponse.json({
      collab: [
        { key: 'demo-room-4', at: minsAgo(12), mine: false },
        { key: 'demo-room-4', at: minsAgo(10), mine: false },
        { key: 'demo-room-4', at: minsAgo(90), mine: true },
        { key: 'demo-room-5', at: minsAgo(40), mine: false },
      ],
      customer: await getCustomerMessageActivity(actor.memberId).catch(() => []),
    })
  }

  const [collab, customer] = await Promise.all([
    getRoomActivity(actor.memberId).catch(() => []),
    getCustomerMessageActivity(actor.memberId).catch(() => []),
  ])
  return NextResponse.json({ collab, customer })
}
