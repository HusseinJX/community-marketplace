'use client'

import { useState } from 'react'
import { Truck, X, MapPin, Phone, User } from 'lucide-react'

interface DeliveryAddress {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
}

interface Props {
  orderId: string
  orderNumber: string
  onClose: () => void
  onDeliveryRequested: (trackingUrl: string) => void
}

type Stage = 'address' | 'quote' | 'confirmed' | 'error'

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function DeliveryRequestModal({ orderId, orderNumber, onClose, onDeliveryRequested }: Props) {
  const [stage, setStage] = useState<Stage>('address')
  const [address, setAddress] = useState<DeliveryAddress>({ name: '', street: '', city: '', state: '', zip: '', phone: '' })
  const [quote, setQuote] = useState<{ quote_id: string; fee_cents: number; dropoff_eta_minutes: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof DeliveryAddress, value: string) {
    setAddress(prev => ({ ...prev, [field]: value }))
  }

  async function getQuote() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/uber/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, dropoff: address }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Quote failed')

      // save delivery address + quote to order
      const saveRes = await fetch('/api/uber/save-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, deliveryAddress: address, quoteId: data.quote.quote_id, feeCents: data.quote.fee_cents }),
      })
      if (!saveRes.ok) throw new Error('Failed to save delivery details')

      setQuote(data.quote)
      setStage('quote')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setLoading(false)
  }

  const isAddressValid = address.name && address.street && address.city && address.state && address.zip && address.phone

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-500" />
            <p className="font-semibold text-stone-900">Request Delivery</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {stage === 'address' && (
            <>
              <p className="text-sm text-stone-500">
                Order <span className="font-medium text-stone-700">{orderNumber}</span> is paid.
                Want it delivered? Enter your address and we'll get an Uber courier.
              </p>

              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="Your name"
                    value={address.name}
                    onChange={e => handleChange('name', e.target.value)}
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="Street address"
                    value={address.street}
                    onChange={e => handleChange('street', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    className="col-span-2 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="City"
                    value={address.city}
                    onChange={e => handleChange('city', e.target.value)}
                  />
                  <input
                    className="col-span-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="ST"
                    maxLength={2}
                    value={address.state}
                    onChange={e => handleChange('state', e.target.value.toUpperCase())}
                  />
                  <input
                    className="col-span-2 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="ZIP"
                    value={address.zip}
                    onChange={e => handleChange('zip', e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="Phone (for delivery updates)"
                    value={address.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={getQuote}
                disabled={!isAddressValid || loading}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {loading ? 'Getting quote…' : 'Get delivery quote'}
              </button>
              <button onClick={onClose} className="w-full text-center text-sm text-stone-400 hover:text-stone-600">
                Skip — I'll pick it up
              </button>
            </>
          )}

          {stage === 'quote' && quote && (
            <>
              <div className="rounded-xl bg-indigo-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Delivery fee</span>
                  <span className="font-semibold text-stone-900">{formatCents(quote.fee_cents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Estimated delivery</span>
                  <span className="font-semibold text-stone-900">~{quote.dropoff_eta_minutes} min</span>
                </div>
                <p className="text-xs text-stone-400 pt-1">
                  A courier will be dispatched when the vendor marks your order ready.
                  You'll get an SMS with tracking.
                </p>
              </div>

              <p className="text-xs text-stone-400">
                Delivering to: {address.street}, {address.city}, {address.state} {address.zip}
              </p>

              <button
                onClick={() => { setStage('confirmed'); onDeliveryRequested('') }}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Confirm delivery — {formatCents(quote.fee_cents)}
              </button>
              <button onClick={onClose} className="w-full text-center text-sm text-stone-400 hover:text-stone-600">
                Cancel
              </button>
            </>
          )}

          {stage === 'confirmed' && (
            <div className="py-4 text-center space-y-3">
              <Truck className="mx-auto h-10 w-10 text-indigo-500" />
              <p className="font-semibold text-stone-900">Delivery requested!</p>
              <p className="text-sm text-stone-500">
                You'll get an SMS at {address.phone} when the courier is on the way.
              </p>
              <button onClick={onClose} className="mt-2 rounded-lg bg-stone-100 px-5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 transition">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
