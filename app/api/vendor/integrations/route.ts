import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile, getVendorSettings, upsertVendorSettings, getVendorConnectAccount } from '@/lib/vendor-connect'
import { resolveActor, isAdmin } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { uberConfigured } from '@/lib/uber-direct'
import { normalizeZip } from '@/lib/fulfillment'
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
    deliveryMode,
    uberDirectEnabled,
    uberPickupAddress,
    uberPickupPhone,
    selfDeliveryFeeCents,
    selfDeliveryFreeOverCents,
    selfDeliveryMinOrderCents,
    selfDeliveryZips,
    selfDeliveryNotes,
  } = body as {
    memberId?: string
    deliveryMode?: 'none' | 'self' | 'uber'
    uberDirectEnabled?: boolean
    uberPickupAddress?: string
    uberPickupPhone?: string
    selfDeliveryFeeCents?: number
    selfDeliveryFreeOverCents?: number | null
    selfDeliveryMinOrderCents?: number | null
    selfDeliveryZips?: string[]
    selfDeliveryNotes?: string
  }

  const actor = await resolveActor(requested ?? null)
  if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ error: 'Not available in demo' }, { status: 403 })

  const gated = await gateCapability(actor.memberId, 'commerce', { bypass: isAdmin(actor.userId) })
  if (gated) return gated

  // `deliveryMode` is the new source of truth; `uberDirectEnabled` is still
  // accepted so older callers keep working. Resolve one from the other and
  // write BOTH, or the two disagree and the read path picks the stale one.
  const mode: 'none' | 'self' | 'uber' | undefined =
    deliveryMode ?? (uberDirectEnabled === undefined ? undefined : uberDirectEnabled ? 'uber' : 'none')

  if (mode === 'uber' && !uberConfigured()) {
    return NextResponse.json(
      { error: 'Courier delivery isn\'t available yet — we\'re still setting it up with Uber. You can deliver it yourself in the meantime.' },
      { status: 503 }
    )
  }

  // Both modes need somewhere to collect from: Uber needs a pickup for the
  // courier, and self-delivery needs it so a buyer choosing pickup still knows
  // where to go. Enforced here rather than at dispatch time, where the customer
  // has already paid.
  const existing = await getVendorSettings(actor.memberId)
  const address = uberPickupAddress ?? existing?.uber_pickup_address
  if ((mode === 'uber' || mode === 'self') && !address?.trim()) {
    return NextResponse.json(
      { error: 'Add your address before turning on delivery.' },
      { status: 400 }
    )
  }

  const fields: Record<string, unknown> = {}
  if (mode !== undefined) {
    fields.delivery_mode = mode
    fields.uber_direct_enabled = mode === 'uber'
  }
  if (uberPickupAddress !== undefined) fields.uber_pickup_address = uberPickupAddress.trim() || null
  if (uberPickupPhone !== undefined) fields.uber_pickup_phone = uberPickupPhone.trim() || null

  const cents = (v: unknown) => Math.max(0, Math.round(Number(v) || 0))
  if (selfDeliveryFeeCents !== undefined) fields.self_delivery_fee_cents = cents(selfDeliveryFeeCents)
  // null clears the rule; these are "no such rule" rather than zero, so an
  // explicit null must survive as null and not collapse to 0.
  if (selfDeliveryFreeOverCents !== undefined)
    fields.self_delivery_free_over_cents = selfDeliveryFreeOverCents == null ? null : cents(selfDeliveryFreeOverCents)
  if (selfDeliveryMinOrderCents !== undefined)
    fields.self_delivery_min_order_cents = selfDeliveryMinOrderCents == null ? null : cents(selfDeliveryMinOrderCents)
  if (selfDeliveryZips !== undefined) {
    const zips = (Array.isArray(selfDeliveryZips) ? selfDeliveryZips : [])
      .map((z) => normalizeZip(String(z)))
      .filter(Boolean)
    // Store empty as an empty array, which quoteSelfDelivery reads as
    // "anywhere" — the zero-typing default.
    fields.self_delivery_zips = Array.from(new Set(zips))
  }
  if (selfDeliveryNotes !== undefined) fields.self_delivery_notes = selfDeliveryNotes.trim().slice(0, 300) || null

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await upsertVendorSettings(actor.memberId, fields)
  const settings = await getVendorSettings(actor.memberId)
  return NextResponse.json({ settings })
}
