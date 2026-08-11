import { NextResponse } from 'next/server'
import { resolveActor, isAdmin } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import {
  getPrintifyCreds,
  savePrintifyCreds,
  disconnectPrintify,
  listShops,
  printifyConfigured,
  PrintifyError,
} from '@/lib/printify'
import { syncPrintifyCatalog } from '@/lib/printify-commerce'

// Connect a vendor's own Printify account, pick a shop, import the catalog.
//
// Printify uses a personal access token rather than OAuth, so the vendor pastes
// one in. That token never comes back out of this API — see GET, which reports
// only whether one exists.

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

  const creds = await getPrintifyCreds(r.actor.memberId)
  // Deliberately never returns the token — not even masked. Nothing in the UI
  // needs it, and an endpoint that can echo a credential is one XSS away from
  // handing it over.
  return NextResponse.json({
    connected: !!creds,
    shopId: creds?.shopId ?? null,
    available: printifyConfigured(),
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const r = await actorFor(body.memberId ?? null)
  if ('error' in r) return r.error
  const memberId = r.actor.memberId

  if (!printifyConfigured()) {
    return NextResponse.json(
      { error: 'Print-on-demand isn\'t switched on for the marketplace yet.' },
      { status: 503 }
    )
  }

  try {
    // ── connect: validate the token by using it ──────────────────────────────
    if (body.action === 'connect') {
      const token = String(body.token ?? '').trim()
      if (!token) return NextResponse.json({ error: 'Paste your Printify API token.' }, { status: 400 })

      // Listing shops IS the validity check — storing a token we've never used
      // is how an integration ends up "connected" and broken, the same mistake
      // the Composio flow made by recording a connection before OAuth returned.
      const shops = await listShops(token)
      if (shops.length === 0) {
        return NextResponse.json(
          { error: 'That token works, but the account has no shops. Create one in Printify first.' },
          { status: 400 }
        )
      }

      // One shop is the common case — pick it rather than asking a question
      // with one answer.
      const shopId = shops.length === 1 ? shops[0].id : (body.shopId ? String(body.shopId) : null)
      await savePrintifyCreds(memberId, { token, shopId })
      return NextResponse.json({ connected: true, shops, shopId })
    }

    // ── shop: choose between several ─────────────────────────────────────────
    if (body.action === 'shop') {
      const creds = await getPrintifyCreds(memberId)
      if (!creds) return NextResponse.json({ error: 'Connect Printify first.' }, { status: 400 })
      await savePrintifyCreds(memberId, { shopId: String(body.shopId ?? '') || null })
      return NextResponse.json({ ok: true })
    }

    // ── sync: import the catalog ─────────────────────────────────────────────
    if (body.action === 'sync') {
      const creds = await getPrintifyCreds(memberId)
      if (!creds?.shopId) return NextResponse.json({ error: 'Connect Printify and pick a shop first.' }, { status: 400 })
      const result = await syncPrintifyCatalog(memberId, String(body.memberName ?? 'Vendor'))
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: unknown) {
    console.error('printify route error:', error)
    if (error instanceof PrintifyError) {
      // 401 from Printify means the token is wrong — say that, rather than
      // making the vendor guess at a generic failure.
      const message =
        error.status === 401
          ? "Printify didn't accept that token. Copy it again from Printify → My Profile → Connections."
          : `Printify said: ${error.message.replace(/^Printify \d+: /, '')}`
      return NextResponse.json({ error: message }, { status: error.status === 401 ? 400 : 502 })
    }
    return NextResponse.json({ error: 'Could not reach Printify. Try again shortly.' }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  const requested = new URL(request.url).searchParams.get('memberId')
  const r = await actorFor(requested)
  if ('error' in r) return r.error

  await disconnectPrintify(r.actor.memberId)
  // Imported products are deliberately LEFT ALONE. They may have been sold, and
  // deleting a vendor's catalog as a side effect of unlinking an account is the
  // kind of destructive surprise nobody asks for. They stay, and stop syncing.
  return NextResponse.json({ connected: false })
}
