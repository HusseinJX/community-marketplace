import { NextResponse } from 'next/server'
import { resolveActor, isAdmin } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import {
  getSquareCreds,
  saveSquareCreds,
  disconnectSquare,
  listLocations,
  listBookableServices,
  squareConfigured,
  SquareError,
  type SquareEnv,
} from '@/lib/square-appointments'

// Connect a vendor's Square Appointments so their real calendar backs the Book
// button. Everything else in the app asks a customer to suggest a time; this is
// the one case where we can offer slots that are genuinely open.

async function actorFor(requested: string | null) {
  const actor = await resolveActor(requested)
  if (!actor) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 401 }) }
  if (actor.isDemo) return { error: NextResponse.json({ error: 'Not available in demo' }, { status: 403 }) }
  const gated = await gateCapability(actor.memberId, 'commerce', { bypass: isAdmin(actor.userId) })
  if (gated) return { error: gated }
  return { actor }
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('memberId')
  const r = await actorFor(requested)
  if ('error' in r) return r.error

  const creds = await getSquareCreds(r.actor.memberId)
  if (!creds) {
    return NextResponse.json({ connected: false, available: squareConfigured() })
  }

  // Services are fetched here so the vendor sees immediately whether their
  // catalog actually has anything bookable — a connected account with no
  // bookable variation produces a Book button that can never offer a slot.
  let services: unknown[] = []
  let warning: string | null = null
  try {
    services = await listBookableServices(creds)
    if (services.length === 0) {
      warning = 'Connected, but no services in this Square account are marked bookable yet.'
    }
  } catch (e) {
    warning = messageFor(e)
  }

  return NextResponse.json({
    connected: true,
    env: creds.env,
    locationId: creds.locationId,
    services,
    warning,
    available: true,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const r = await actorFor(body.memberId ?? null)
  if ('error' in r) return r.error
  const memberId = r.actor.memberId

  if (!squareConfigured()) {
    return NextResponse.json({ error: 'Bookings integration isn\'t switched on yet.' }, { status: 503 })
  }

  try {
    if (body.action === 'connect') {
      const token = String(body.token ?? '').trim()
      if (!token) return NextResponse.json({ error: 'Paste your Square access token.' }, { status: 400 })
      const env: SquareEnv = body.env === 'sandbox' ? 'sandbox' : 'production'

      // Using the token IS the check. It also surfaces the predictable failure
      // early: a token minted for catalog/orders has no APPOINTMENTS_* scope,
      // and a vendor who "already connected Square" will hit exactly that.
      const locations = await listLocations({ token, locationId: null, env })
      if (locations.length === 0) {
        return NextResponse.json({ error: 'That token has no Square locations.' }, { status: 400 })
      }
      const locationId = locations.length === 1 ? locations[0].id : (body.locationId ? String(body.locationId) : null)
      await saveSquareCreds(memberId, { token, locationId, env })
      return NextResponse.json({ connected: true, locations, locationId, env })
    }

    if (body.action === 'location') {
      const creds = await getSquareCreds(memberId)
      if (!creds) return NextResponse.json({ error: 'Connect Square first.' }, { status: 400 })
      await saveSquareCreds(memberId, { locationId: String(body.locationId ?? '') || null })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('square appointments error:', e)
    return NextResponse.json({ error: messageFor(e) }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const requested = new URL(request.url).searchParams.get('memberId')
  const r = await actorFor(requested)
  if ('error' in r) return r.error
  await disconnectSquare(r.actor.memberId)
  // Existing bookings are left alone — they're real appointments in Square, and
  // unlinking an account must not quietly cancel someone's haircut.
  return NextResponse.json({ connected: false })
}

function messageFor(e: unknown): string {
  if (e instanceof SquareError) {
    if (e.code === 'INSUFFICIENT_SCOPES' || e.status === 403) {
      return "That token can't manage bookings. It needs APPOINTMENTS_READ, APPOINTMENTS_WRITE, ITEMS_READ (to find your bookable services) and CUSTOMERS_WRITE (Square requires a customer on every booking). The Square connection used for catalog syncing has none of these."
    }
    if (e.status === 401) return "Square didn't accept that token. Check you copied it in full, and that it matches the environment you picked."
    return `Square said: ${e.message}`
  }
  return 'Could not reach Square. Try again shortly.'
}
