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

export type DeliveryMode = 'none' | 'self' | 'uber' | 'printify'

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
  /** Printify: it's posted to them, so there is no pickup to offer. */
  shippingOnly?: boolean
  deliveryMode: DeliveryMode
  deliveryAvailable: boolean
  selfDelivery: SelfRules | null
  /** False when the vendor has stated no address and no arrangement. */
  pickupAvailable?: boolean
  pickupAddress: string | null
  pickupNote?: string | null
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
        // be inventing a step.
        if (d.shippingOnly) {
          // Posted, so delivery is the only mode — and it isn't payable until
          // postage has been quoted for a real address.
          setType('delivery')
          onChange(null)
          return
        }
        if (d.basket === 'digital' || d.basket === 'service') {
          onChange({ type: d.basket === 'digital' ? 'digital' : 'service' })
          return
        }
        // PICKUP IS NO LONGER THE FALLBACK. It was: any physical basket
        // defaulted to pickup, so a vendor who had stated neither an address
        // nor an arrangement still took the money, and the buyer found out
        // afterwards that nobody had said where to go.
        const canPickup = (d.pickupAvailable ?? !!d.pickupAddress) === true
        if (canPickup) {
          setType('pickup')
          onChange({ type: 'pickup' })
        } else {
          // Delivery is the only way this can happen, and it needs a quote
          // first — so nothing is payable yet.
          setType('delivery')
          onChange(null)
        }
      })
      .catch(() => alive && setOpts({ deliveryMode: 'none', deliveryAvailable: false, selfDelivery: null, pickupAvailable: false, pickupAddress: null, pickupNote: null }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  function pick(next: 'pickup' | 'delivery') {
    setType(next)
    setError(null)
    if (next === 'pickup') {
      setQuote(null)
      // The button is hidden without an arrangement; this is the belt to that
      // brace, because "payable" is the one state worth being paranoid about.
      onChange(pickupOffered ? { type: 'pickup' } : null)
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

  // Postage, straight from Printify. Same shape as the courier quote — it's a
  // real upstream call that can fail, unlike the vendor's own flat rule.
  async function getPrintifyQuote() {
    setQuoting(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/printify-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, items: items ?? [], address: addr }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.message ?? 'Could not work out postage for that address.')
        onChange(null)
      } else {
        setQuote({ feeCents: data.feeCents, quoteId: '' })
        onChange({ type: 'delivery', address: addr, feeCents: data.feeCents })
      }
    } catch {
      setError('Could not work out postage for that address.')
      onChange(null)
    }
    setQuoting(false)
  }

  async function getQuote() {
    if (opts?.deliveryMode === 'self') return getSelfQuote()
    if (opts?.deliveryMode === 'printify') return getPrintifyQuote()
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

  // Whether pickup can be offered at all, and the one line the buyer reads.
  //
  // `pickupAvailable` is the server's answer; the address fallback keeps an
  // older client honest if it ever meets a newer server, and vice versa. The
  // line is the vendor's address or the vendor's own words — never a sentence
  // we invented on their behalf.
  const pickupOffered = opts.pickupAvailable ?? !!opts.pickupAddress
  const pickupLine = opts.pickupAddress
    ? <>Collect from <span className="font-medium">{opts.pickupAddress}</span>.{opts.pickupNote ? ` ${opts.pickupNote}` : ''}</>
    : <>{opts.pickupNote}</>

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

  // No delivery AND no stated pickup: there is no way to hand this over, so
  // there is nothing to buy. Blocked BEFORE payment — the alternative is
  // taking someone's money for an arrangement that does not exist, which is
  // what "the vendor will contact you about collecting your order" used to be.
  if (!opts.deliveryAvailable && !pickupOffered) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <Store className="h-4 w-4 text-amber-600" /> Not ready to sell this yet
        </p>
        <p className="mt-1 text-sm text-amber-800">
          This seller hasn&apos;t said how you&apos;d get it — no collection point and no
          delivery. Message them from their page and they can turn it on.
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
        <p className="mt-1 text-sm text-stone-600">{pickupLine}</p>
      </div>
    )
  }

  const addrComplete = addr.street && addr.city && addr.state && addr.zip && addr.phone

  // Nothing to toggle: it's made to order and posted, so "Pick up" would be an
  // option the vendor cannot honour. The mode is set when the options load, in
  // the fetch callback — never during render.
  const shippingOnly = !!opts.shippingOnly

  return (
    <div className="space-y-3">
      <div className={'flex gap-2 ' + (shippingOnly || !pickupOffered ? 'hidden' : '')}>
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
        <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{pickupLine}</p>
      ) : (
        <div className="space-y-2 rounded-xl bg-stone-50 p-3">
          {/* State the vendor's own terms BEFORE the address form. The fee is
              knowable from the basket alone, so making someone fill in six
              fields to discover a $5 charge (or a minimum they haven't met) is
              the exact friction this replaces. */}
          {shippingOnly && (
            <p className="rounded-lg bg-white p-2.5 text-xs text-stone-600">
              <span className="font-medium text-stone-800">Made to order and posted to you.</span>{' '}
              Postage is worked out from your address.
            </p>
          )}
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
