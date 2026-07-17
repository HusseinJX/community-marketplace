import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile, getVendorSettings, upsertVendorSettings, getVendorConnectAccount } from '@/lib/vendor-connect'
import { resolveActor, isAdmin } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { uberConfigured } from '@/lib/uber-direct'
import { stripe } from '@/lib/stripe-server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const settings = await getVendorSettings(profile.member_id)

  // Stripe payout status, so the consolidated Integrations page can show the
  // bank card without a second round-trip. 'none' until an account exists;
  // 'pending' if Stripe is unreachable (the row exists = setup was started, and
  // claiming 'active' when we can't confirm would hide the finish link).
  let stripeStatus: 'none' | 'pending' | 'active' = 'none'
  const account = await getVendorConnectAccount(profile.member_id)
  if (account) {
    try {
      const acct = await stripe.accounts.retrieve(account.stripe_account_id)
      stripeStatus = acct.details_submitted && acct.charges_enabled ? 'active' : 'pending'
    } catch {
      stripeStatus = 'pending'
    }
  }

  // The delivery toggle is only honest if the platform actually has Uber
  // credentials — otherwise a vendor flips it on and dispatch fails.
  return NextResponse.json({ settings, uberAvailable: uberConfigured(), stripeStatus })
}

// Vendor-editable delivery settings. Previously uber_direct_enabled was read in
// three places and written nowhere — turning delivery on meant a hand-written
// UPDATE against the database.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}))
  const {
    memberId: requested,
    uberDirectEnabled,
    uberPickupAddress,
    uberPickupPhone,
  } = body as {
    memberId?: string
    uberDirectEnabled?: boolean
    uberPickupAddress?: string
    uberPickupPhone?: string
  }

  const actor = await resolveActor(requested ?? null)
  if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ error: 'Not available in demo' }, { status: 403 })

  const gated = await gateCapability(actor.memberId, 'commerce', { bypass: isAdmin(actor.userId) })
  if (gated) return gated

  if (uberDirectEnabled === true && !uberConfigured()) {
    return NextResponse.json(
      { error: 'Delivery isn\'t available yet — we\'re still setting it up with Uber.' },
      { status: 503 }
    )
  }

  // Dispatch needs somewhere to collect from. Enforced here rather than at
  // dispatch time, where the customer has already paid.
  const existing = await getVendorSettings(actor.memberId)
  const address = uberPickupAddress ?? existing?.uber_pickup_address
  if (uberDirectEnabled === true && !address?.trim()) {
    return NextResponse.json(
      { error: 'Add a pickup address before turning on delivery.' },
      { status: 400 }
    )
  }

  const fields: Record<string, unknown> = {}
  if (uberDirectEnabled !== undefined) fields.uber_direct_enabled = uberDirectEnabled
  if (uberPickupAddress !== undefined) fields.uber_pickup_address = uberPickupAddress.trim() || null
  if (uberPickupPhone !== undefined) fields.uber_pickup_phone = uberPickupPhone.trim() || null

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await upsertVendorSettings(actor.memberId, fields)
  const settings = await getVendorSettings(actor.memberId)
  return NextResponse.json({ settings })
}
