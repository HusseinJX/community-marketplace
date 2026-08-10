'use client'

import { useEffect, useState } from 'react'
import { Store, Truck, Loader2, Download, CalendarClock } from 'lucide-react'

export interface Fulfillment {
  type: 'pickup' | 'delivery' | 'digital' | 'service'
  /** Delivery only — quoted before payment so the fee can actually be charged. */
  address?: DeliveryAddress
  feeCents?: number
  quoteId?: string
}

export interface DeliveryAddress {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
}

export type DeliveryMode = 'none' | 'self' | 'uber'

interface SelfRules {
  feeCents: number
  freeOverCents: number | null
  minOrderCents: number | null
  zips: string[]
  notes: string | null
}

interface Options {
  /** What the basket needs. Non-physical baskets have nothing to arrange. */
  basket?: 'physical' | 'digital' | 'service'
  deliveryMode: DeliveryMode
  deliveryAvailable: boolean
  selfDelivery: SelfRules | null
  pickupAddress: string | null
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

// Pickup or delivery, chosen BEFORE payment.
//
// This replaces DeliveryRequestModal, which appeared *after* the buyer had paid,
// was shown to every buyer regardless of whether the vendor offered delivery,
// and whose "Skip — I'll pick it up" button wrote nothing at all. Quoting up
// front is what lets the courier fee go into the PaymentIntent instead of being
// silently absorbed by the platform.
export function FulfillmentPicker({
  memberId,
  items,
  onChange,
}: {
  memberId: string
  /**
   * The basket, needed for self-delivery: the fee depends on the subtotal
   * (free over X, minimum order), and the server re-prices from the catalog
   * rather than trusting a number the browser calculated.
   */
  items?: { name: string; quantity: number }[]
  onChange: (f: Fulfillment | null) => void
}) {
  const [opts, setOpts] = useState<Options | null>(null)
  const [type, setType] = useState<'pickup' | 'delivery'>('pickup')
  const [addr, setAddr] = useState<DeliveryAddress>({
    name: '', street: '', city: '', state: '', zip: '', phone: '',
  })
  const [quote, setQuote] = useState<{ feeCents: number; quoteId: string } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const query = (items ?? []).map(i => `item=${encodeURIComponent(i.name)}`).join('&')
    fetch(`/api/checkout/fulfillment/${memberId}${query ? `?${query}` : ''}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        setOpts(d)
        // A basket with nothing to hand over is payable immediately — there is
        // no address to take and no time to arrange, so asking for either would
        // be inventing a step. Otherwise pickup is the default and the
        // fallback: if a vendor doesn't deliver, the buyer just gets an address.
        onChange({ type: d.basket === 'digital' ? 'digital' : d.basket === 'service' ? 'service' : 'pickup' })
      })
      .catch(() => alive && setOpts({ deliveryMode: 'none', deliveryAvailable: false, selfDelivery: null, pickupAddress: null }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  function pick(next: 'pickup' | 'delivery') {
    setType(next)
    setError(null)
    if (next === 'pickup') {
      setQuote(null)
      onChange({ type: 'pickup' })
    } else {
      // Not payable until a quote exists — the parent hides Pay until onChange
      // hands it a complete delivery.
      onChange(null)
    }
  }

  // Self-delivery: no external call, no quote id — the vendor's own rule
  // applied to the basket. The server still recomputes it at payment, so this
  // is the buyer seeing the same arithmetic in advance rather than a promise.
  async function getSelfQuote() {
    setQuoting(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/self-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, items: items ?? [], zip: addr.zip }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.message ?? "This vendor isn't delivering to that address.")
        onChange(null)
      } else {
        setQuote({ feeCents: data.feeCents, quoteId: '' })
        onChange({ type: 'delivery', address: addr, feeCents: data.feeCents })
      }
    } catch {
      setError('Could not price that delivery.')
      onChange(null)
    }
    setQuoting(false)
  }

  async function getQuote() {
    if (opts?.deliveryMode === 'self') return getSelfQuote()
    setQuoting(true)
    setError(null)
    try {
      const res = await fetch('/api/uber/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, dropoff: addr }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(
          data.error === 'DELIVERY_UNAVAILABLE'
            ? "This vendor isn't delivering right now — pickup only."
            : data.error ?? 'Could not price that delivery.'
        )
        onChange(null)
      } else {
        const feeCents = data.quote.fee_cents
        const quoteId = data.quote.quote_id
        setQuote({ feeCents, quoteId })
        onChange({ type: 'delivery', address: addr, feeCents, quoteId })
      }
    } catch {
      setError('Could not price that delivery.')
      onChange(null)
    }
    setQuoting(false)
  }

  if (!opts) {
    return <p className="text-sm text-stone-400">Checking options…</p>
  }

  // Nothing to fulfil in the physical sense. Say what actually happens next
  // instead of the old "Pick up / collect from…", which was the lie this whole
  // `kind` column exists to stop.
  if (opts.basket === 'digital') {
    return (
      <div className="rounded-xl bg-stone-50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <Download className="h-4 w-4 text-stone-400" /> Instant download
        </p>
        <p className="mt-1 text-sm text-stone-600">
          We&apos;ll email your download link as soon as the payment goes through.
        </p>
      </div>
    )
  }

  if (opts.basket === 'service') {
    return (
      <div className="rounded-xl bg-stone-50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <CalendarClock className="h-4 w-4 text-stone-400" /> Booked with the business
        </p>
        <p className="mt-1 text-sm text-stone-600">
          They&apos;ll be in touch to arrange a time once you&apos;ve paid.
        </p>
      </div>
    )
  }

  // Nothing to choose — say where to collect and move on.
  if (!opts.deliveryAvailable) {
    return (
      <div className="rounded-xl bg-stone-50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <Store className="h-4 w-4 text-stone-400" /> Pickup
        </p>
        <p className="mt-1 text-sm text-stone-600">
          {opts.pickupAddress
            ? <>Collect from <span className="font-medium">{opts.pickupAddress}</span>. They&apos;ll let you know when it&apos;s ready.</>
            : "The vendor will contact you about collecting your order."}
        </p>
      </div>
    )
  }

  const addrComplete = addr.street && addr.city && addr.state && addr.zip && addr.phone

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['pickup', 'delivery'] as const).map(t => (
          <button
            key={t}
            onClick={() => pick(t)}
            className={
              'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ' +
              (type === t
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300')
            }
          >
            {t === 'pickup' ? <Store className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            {t === 'pickup' ? 'Pick up' : 'Delivery'}
          </button>
        ))}
      </div>

      {type === 'pickup' ? (
        <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
          {opts.pickupAddress
            ? <>Collect from <span className="font-medium">{opts.pickupAddress}</span>.</>
            : 'The vendor will contact you about collecting your order.'}
        </p>
      ) : (
        <div className="space-y-2 rounded-xl bg-stone-50 p-3">
          {/* State the vendor's own terms BEFORE the address form. The fee is
              knowable from the basket alone, so making someone fill in six
              fields to discover a $5 charge (or a minimum they haven't met) is
              the exact friction this replaces. */}
          {opts.selfDelivery && (
            <div className="rounded-lg bg-white p-2.5 text-xs text-stone-600">
              <p className="font-medium text-stone-800">
                {opts.selfDelivery.feeCents === 0
                  ? 'Free delivery'
                  : `${money(opts.selfDelivery.feeCents)} delivery`}
                {opts.selfDelivery.freeOverCents != null &&
                  ` · free over ${money(opts.selfDelivery.freeOverCents)}`}
              </p>
              {opts.selfDelivery.minOrderCents != null && (
                <p className="mt-0.5">Minimum order {money(opts.selfDelivery.minOrderCents)}</p>
              )}
              {opts.selfDelivery.zips.length > 0 && (
                <p className="mt-0.5">Delivers to {opts.selfDelivery.zips.join(', ')}</p>
              )}
              {opts.selfDelivery.notes && <p className="mt-0.5">{opts.selfDelivery.notes}</p>}
              <p className="mt-1 text-stone-400">Delivered by the business themselves.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Name" value={addr.name} onChange={e => { setAddr({ ...addr, name: e.target.value }); setQuote(null); onChange(null) }} className="col-span-2 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
            <input placeholder="Street address" value={addr.street} onChange={e => { setAddr({ ...addr, street: e.target.value }); setQuote(null); onChange(null) }} className="col-span-2 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
            <input placeholder="City" value={addr.city} onChange={e => { setAddr({ ...addr, city: e.target.value }); setQuote(null); onChange(null) }} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
            <input placeholder="State" value={addr.state} onChange={e => { setAddr({ ...addr, state: e.target.value }); setQuote(null); onChange(null) }} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
            <input placeholder="ZIP" value={addr.zip} onChange={e => { setAddr({ ...addr, zip: e.target.value }); setQuote(null); onChange(null) }} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
            <input placeholder="Phone" value={addr.phone} onChange={e => { setAddr({ ...addr, phone: e.target.value }); setQuote(null); onChange(null) }} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
          </div>

          {quote ? (
            <p className="text-sm font-medium text-stone-800">
              {quote.feeCents === 0 ? 'Delivery: free' : `Delivery fee: ${money(quote.feeCents)}`}
              {quote.feeCents > 0 && (
                <span className="ml-1 font-normal text-stone-500">— added to your total</span>
              )}
            </p>
          ) : (
            <button
              onClick={getQuote}
              disabled={!addrComplete || quoting}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
            >
              {quoting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {quoting ? 'Pricing…' : opts.deliveryMode === 'self' ? 'Check this address' : 'Get delivery price'}
            </button>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
