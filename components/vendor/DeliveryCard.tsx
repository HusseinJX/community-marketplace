'use client'

import { useState } from 'react'
import { Truck, CheckCircle } from 'lucide-react'

interface Props {
  enabled: boolean
  pickupAddress: string | null
  pickupPhone: string | null
  /** False when the platform has no Uber credentials — the toggle stays off. */
  available: boolean
}

// Vendor-facing delivery switch. uber_direct_enabled used to be settable only by
// a hand-written UPDATE, so no vendor could offer delivery on their own.
export function DeliveryCard({ enabled, pickupAddress, pickupPhone, available }: Props) {
  const [on, setOn] = useState(enabled)
  const [address, setAddress] = useState(pickupAddress ?? '')
  const [phone, setPhone] = useState(pickupPhone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(next: { uberDirectEnabled?: boolean }) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/vendor/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uberPickupAddress: address,
          uberPickupPhone: phone,
          ...next,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.')
        // The server refused, so don't leave the switch showing a state it isn't in.
        if (next.uberDirectEnabled !== undefined) setOn(!next.uberDirectEnabled)
      } else {
        setOn(!!data.settings?.uber_direct_enabled)
        setSaved(true)
      }
    } catch {
      setError('Could not save. Try again.')
      if (next.uberDirectEnabled !== undefined) setOn(!next.uberDirectEnabled)
    }
    setBusy(false)
  }

  function toggle() {
    const next = !on
    setOn(next)
    save({ uberDirectEnabled: next })
  }

  return (
    <div className="card-soft space-y-5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-stone-400" />
          <div>
            <p className="font-semibold text-stone-900">Delivery</p>
            <p className="mt-0.5 text-sm text-stone-500">
              Let customers get orders delivered by an Uber courier.
            </p>
          </div>
        </div>
        {on && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" />
            On
          </span>
        )}
      </div>

      {!available ? (
        <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">
          Delivery isn&apos;t switched on for the marketplace yet. We&apos;ll let you know
          the moment it is — your customers can still order for pickup.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-stone-600">Pickup address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Valencia St, San Francisco, CA 94110"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block">
              <span className="text-sm text-stone-600">Pickup phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(415) 555-0132"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggle}
              disabled={busy}
              className={
                'rounded-lg px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-50 ' +
                (on
                  ? 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700')
              }
            >
              {busy ? 'Saving…' : on ? 'Turn off delivery' : 'Turn on delivery'}
            </button>
            {on && (
              <button
                onClick={() => save({})}
                disabled={busy}
                className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 disabled:opacity-50"
              >
                Save address
              </button>
            )}
            {saved && !error && <span className="text-sm text-emerald-600">Saved</span>}
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </>
      )}

      {/* ⚠️ Do NOT claim "the customer pays the delivery fee" here (an earlier
          draft of this card did). They don't — and can't, as built. The buyer
          pays for items BEFORE the delivery modal appears, and the quoted fee is
          only stored on the order (`delivery_fee_cents`) and displayed to the
          vendor. There is no second charge anywhere, so the platform would eat
          every courier fee. See the delivery blockers in CLAUDE.md. */}
      <p className="text-xs text-stone-400">
        Uber quotes the fee once the customer enters their address. You&apos;ll get a
        &ldquo;Ready — dispatch&rdquo; button on each order.
      </p>
    </div>
  )
}
