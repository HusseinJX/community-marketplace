import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import {
  createContribution,
  getContributionsByVendor,
  getContributionsForOrg,
  type ContributionKind,
} from '@/lib/contributions'

const KINDS: ContributionKind[] = ['funds', 'goods', 'time', 'other']

// GET — the acting member's giving dashboard: gifts they've given (outgoing) and
// gifts addressed to them as an org awaiting confirmation (incoming).
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [outgoing, incoming] = await Promise.all([
    getContributionsByVendor(actor.memberId),
    getContributionsForOrg(actor.memberId, 'pending'),
  ])
  return NextResponse.json({ memberId: actor.memberId, outgoing, incoming })
}

// POST — log a gift to a community org. Body: { memberId?, orgId, orgName?, kind, description, amountCents? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = String(body.orgId ?? '').trim()
  const description = String(body.description ?? '').trim()
  const kind: ContributionKind = KINDS.includes(body.kind) ? body.kind : 'other'
  if (!orgId || !description) {
    return NextResponse.json({ error: 'Pick an org and describe the gift' }, { status: 400 })
  }

  // Denormalize both names so the profile badge and org inbox render without
  // re-fetching the connector per row.
  let vendorName: string | null = null
  let orgName: string | null = body.orgName ? String(body.orgName) : null
  try {
    const v = await getMember(actor.memberId)
    vendorName =
      (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || null
  } catch {
    /* non-fatal */
  }
  if (!orgName) {
    try {
      const o = await getMember(orgId)
      orgName = (o.member.profile?.name as string) || null
    } catch {
      /* non-fatal */
    }
  }

  const amountCents =
    kind === 'funds' && Number.isFinite(Number(body.amountCents)) && Number(body.amountCents) > 0
      ? Math.round(Number(body.amountCents))
      : null

  try {
    const contribution = await createContribution({
      vendor_id: actor.memberId,
      vendor_name: vendorName,
      org_id: orgId,
      org_name: orgName,
      kind,
      description,
      amount_cents: amountCents,
    })
    return NextResponse.json({ contribution })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log gift'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
