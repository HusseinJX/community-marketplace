'use client'

import { useState } from 'react'
import { Truck, CheckCircle, Car, Store } from 'lucide-react'

export type DeliveryMode = 'none' | 'self' | 'uber'

interface Props {
  mode: DeliveryMode
  pickupAddress: string | null
  pickupPhone: string | null
  /** False when the platform has no Uber credentials — the courier option stays locked. */
  uberAvailable: boolean
  selfFeeCents: number
  selfFreeOverCents: number | null
  selfMinOrderCents: number | null
  selfZips: string[]
  selfNotes: string | null
}

// Dollars in the input, cents on the wire. Vendors type "4.50", never "450".
function toCents(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
function toDollars(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2).replace(/\.00$/, '')
}

/**
 * How this business gets orders to people.
 *
 * Three choices, and "I deliver it myself" is deliberately the FIRST and the
 * recommended one: most local businesses already drive their own orders, Uber
 * is blocked on account activation, and a vendor shouldn't have to wait on our
 * courier integration to offer something they already do every day.
 */
export function DeliveryCard({
  mode: initialMode,
  pickupAddress,
  pickupPhone,
  uberAvailable,
  selfFeeCents,
  selfFreeOverCents,
  selfMinOrderCents,
  selfZips,
  selfNotes,
}: Props) {
  const [mode, setMode] = useState<DeliveryMode>(initialMode)
  const [address, setAddress] = useState(pickupAddress ?? '')
  const [phone, setPhone] = useState(pickupPhone ?? '')
  const [fee, setFee] = useState(toDollars(selfFeeCents))
  const [freeOver, setFreeOver] = useState(toDollars(selfFreeOverCents))
  const [minOrder, setMinOrder] = useState(toDollars(selfMinOrderCents))
  const [zips, setZips] = useState((selfZips ?? []).join(', '))
  const [notes, setNotes] = useState(selfNotes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(nextMode: DeliveryMode) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/vendor/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryMode: nextMode,
          uberPickupAddress: address,
          uberPickupPhone: phone,
          selfDeliveryFeeCents: toCents(fee),
          // Blank means "no such rule", which is null — not zero. A zero
          // free-over threshold would make every order free delivery.
          selfDeliveryFreeOverCents: freeOver.trim() === '' ? null : toCents(freeOver),
          selfDeliveryMinOrderCents: minOrder.trim() === '' ? null : toCents(minOrder),
          selfDeliveryZips: zips.split(/[,\s]+/).map((z) => z.trim()).filter(Boolean),
          selfDeliveryNotes: notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.')
        // The server refused, so don't leave the card showing a mode it isn't in.
        setMode(initialMode)
      } else {
        setMode((data.settings?.delivery_mode as DeliveryMode) ?? nextMode)
        setSaved(true)
      }
    } catch {
      setError('Could not save. Try again.')
      setMode(initialMode)
    }
    setBusy(false)
  }

  const options: { key: DeliveryMode; icon: typeof Store; title: string; blurb: string; locked?: boolean }[] = [
    { key: 'none', icon: Store, title: 'Pickup only', blurb: 'Customers collect from you.' },
    { key: 'self', icon: Car, title: 'I deliver it myself', blurb: 'You drive. You set the fee and you keep it.' },
    {
      key: 'uber',
      icon: Truck,
      title: 'Uber courier',
      blurb: uberAvailable ? 'We dispatch a courier and handle the fee.' : 'Not switched on for the marketplace yet.',
      locked: !uberAvailable,
    },
  ]

  return (
    <div className="card-soft space-y-5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-stone-400" />
          <div>
            <p className="font-semibold text-stone-900">Delivery</p>
            <p className="mt-0.5 text-sm text-stone-500">How orders get to your customers.</p>
          </div>
        </div>
        {mode !== 'none' && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" />
            On
          </span>
        )}
      </div>

      <div className="space-y-2">
        {options.map((o) => {
          const Icon = o.icon
          const active = mode === o.key
          return (
            <button
              key={o.key}
              onClick={() => !o.locked && setMode(o.key)}
              disabled={o.locked || busy}
              className={
                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ' +
                (active
                  ? 'border-indigo-500 bg-indigo-50'
                  : o.locked
                    ? 'cursor-not-allowed border-stone-100 bg-stone-50 opacity-60'
                    : 'border-stone-200 bg-white hover:border-stone-300')
              }
            >
              <Icon className={'mt-0.5 h-4 w-4 shrink-0 ' + (active ? 'text-indigo-600' : 'text-stone-400')} />
              <span className="min-w-0 flex-1">
                <span className={'block text-sm font-medium ' + (active ? 'text-indigo-900' : 'text-stone-900')}>
                  {o.title}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">{o.blurb}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm text-stone-600">
            {mode === 'none' ? 'Pickup address' : 'Your address'}
          </span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Valencia St, San Francisco, CA 94110"
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
        </label>
        <label className="block">
          <span className="text-sm text-stone-600">Contact phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(415) 555-0132"
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
        </label>
      </div>

      {mode === 'self' && (
        <div className="space-y-3 rounded-xl bg-stone-50 p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-stone-600">Delivery fee</span>
              <div className="mt-1 flex items-center rounded-md border border-stone-300 bg-white px-2.5">
                <span className="text-sm text-stone-400">$</span>
                <input
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  inputMode="decimal"
                  placeholder="5"
                  className="w-full bg-transparent py-1.5 pl-1 text-sm outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-stone-600">Free over</span>
              <div className="mt-1 flex items-center rounded-md border border-stone-300 bg-white px-2.5">
                <span className="text-sm text-stone-400">$</span>
                <input
                  value={freeOver}
                  onChange={(e) => setFreeOver(e.target.value)}
                  inputMode="decimal"
                  placeholder="Never"
                  className="w-full bg-transparent py-1.5 pl-1 text-sm outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-stone-600">Minimum order</span>
              <div className="mt-1 flex items-center rounded-md border border-stone-300 bg-white px-2.5">
                <span className="text-sm text-stone-400">$</span>
                <input
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  inputMode="decimal"
                  placeholder="None"
                  className="w-full bg-transparent py-1.5 pl-1 text-sm outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-stone-600">ZIP codes you cover</span>
              <input
                value={zips}
                onChange={(e) => setZips(e.target.value)}
                placeholder="Anywhere"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-stone-600">When you deliver <span className="text-stone-400">(optional)</span></span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tuesday & Thursday evenings, 5–8pm"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
            />
          </label>

          {/* Say the two non-obvious rules out loud, because both are easy to
              get backwards: blank ZIPs is permissive, not restrictive, and the
              fee is genuinely theirs. */}
          <p className="text-xs text-stone-500">
            Leave ZIP codes blank to deliver anywhere. The delivery fee goes to you in full —
            our 5% is only ever on the items.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(mode)}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save delivery settings'}
        </button>
        {saved && !error && <span className="text-sm text-emerald-600">Saved</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>

      <p className="text-xs text-stone-400">
        {mode === 'self'
          ? 'Customers see your fee before they pay, and it lands in your payout with the order.'
          : mode === 'uber'
            ? 'Uber quotes the fee once the customer enters their address. You get a "Ready — dispatch" button on each order.'
            : 'Customers will see your address and collect their order from you.'}
      </p>
    </div>
  )
}
