'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useStore } from '@/lib/store'
import { StoredProduct } from '@/lib/store'
import DeliveryRequestModal from '@/components/DeliveryRequestModal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface VendorGroup {
  memberId: string
  memberName: string
  items: StoredProduct[]
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function groupByVendor(cart: StoredProduct[]): VendorGroup[] {
  const map = new Map<string, VendorGroup>()
  for (const item of cart) {
    if (!map.has(item.memberId)) {
      map.set(item.memberId, { memberId: item.memberId, memberName: item.memberName, items: [] })
    }
    map.get(item.memberId)!.items.push(item)
  }
  return Array.from(map.values())
}

interface PaymentFormProps {
  clientSecret: string
  paymentIntentId: string
  memberId: string
  onSuccess: (memberId: string, orderNumber: string, orderId: string) => void
}

function PaymentForm({ clientSecret, paymentIntentId, memberId, onSuccess }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Payment failed')
      setPaying(false)
      return
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: window.location.origin + '/checkout/success' },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed')
      setPaying(false)
      return
    }

    // Payment succeeded — confirm server-side
    try {
      const res = await fetch('/api/checkout/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      })
      const data = await res.json()
      if (data.success) {
        onSuccess(memberId, data.orderNumber, data.orderId)
      } else {
        setError(data.error ?? 'Payment confirmation failed')
      }
    } catch {
      setError('Payment confirmation failed. Please contact support.')
    }
    setPaying(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={paying || !stripe}
        className="w-full rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {paying ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  )
}

interface VendorCheckoutCardProps {
  group: VendorGroup
  onVendorPaid: (memberId: string, orderNumber: string, orderId: string) => void
}

function VendorCheckoutCard({ group, onVendorPaid }: VendorCheckoutCardProps) {
  const [state, setState] = useState<
    | { stage: 'idle' }
    | { stage: 'loading' }
    | { stage: 'payment'; clientSecret: string; paymentIntentId: string; amount: number; platformFee: number; vendorAmount: number }
    | { stage: 'no_connect'; message: string }
    | { stage: 'error'; message: string }
  >({ stage: 'idle' })

  const hasAllPrices = group.items.every(item => typeof item.price === 'number')
  const total = group.items.reduce((sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0)

  const handlePay = useCallback(async () => {
    setState({ stage: 'loading' })
    try {
      const res = await fetch('/api/checkout/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: group.memberId,
          items: group.items.map(item => ({
            name: item.name,
            memberId: item.memberId,
            price: item.price ?? 0,
            quantity: item.qty ?? 1,
          })),
        }),
      })
      const data = await res.json()

      if (data.error === 'STRIPE_CONNECT_NOT_SETUP') {
        setState({ stage: 'no_connect', message: data.message })
        return
      }
      if (!res.ok || data.error) {
        setState({ stage: 'error', message: data.error ?? 'Failed to start checkout' })
        return
      }

      setState({
        stage: 'payment',
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        amount: data.amount,
        platformFee: data.platformFee,
        vendorAmount: data.vendorAmount,
      })
    } catch {
      setState({ stage: 'error', message: 'Failed to start checkout. Please try again.' })
    }
  }, [group])

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-stone-900">
          <Link href={`/members/${group.memberId}`} className="hover:underline text-indigo-700">
            {group.memberName}
          </Link>
        </h2>
        {hasAllPrices && (
          <span className="text-sm font-medium text-stone-700">
            Total: {formatCents(total)}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {group.items.map(item => {
          const qty = item.qty ?? 1
          const line = (item.price ?? 0) * qty
          return (
            <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-stone-700">
                {item.name}
                {qty > 1 && <span className="ml-1 text-stone-400">× {qty}</span>}
              </span>
              {typeof item.price === 'number' ? (
                <span className="font-medium text-stone-900">{formatCents(line)}</span>
              ) : (
                <span className="text-stone-400 italic">Price not set — contact vendor</span>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-4">
        {state.stage === 'idle' && (
          <>
            {!hasAllPrices ? (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                Some items have no price set. Contact the vendor to complete your purchase.
              </p>
            ) : (
              <button
                onClick={handlePay}
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Pay {formatCents(total)}
              </button>
            )}
          </>
        )}

        {state.stage === 'loading' && (
          <p className="text-sm text-stone-500">Loading payment...</p>
        )}

        {state.stage === 'no_connect' && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            {state.message}
          </p>
        )}

        {state.stage === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{state.message}</p>
            <button
              onClick={() => setState({ stage: 'idle' })}
              className="text-xs text-stone-500 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {state.stage === 'payment' && (
          <div>
            <div className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              <span className="font-medium">Platform fee:</span> {formatCents(state.platformFee)} &bull;{' '}
              <span className="font-medium">Vendor receives:</span> {formatCents(state.vendorAmount)}
            </div>
            <Elements
              stripe={stripePromise}
              options={{ clientSecret: state.clientSecret, appearance: { theme: 'stripe' } }}
            >
              <PaymentForm
                clientSecret={state.clientSecret}
                paymentIntentId={state.paymentIntentId}
                memberId={group.memberId}
                onSuccess={onVendorPaid}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const { cart, removeFromCart } = useStore()
  const [paidVendors, setPaidVendors] = useState<Record<string, { orderNumber: string; orderId: string }>>({})
  const [deliveryModal, setDeliveryModal] = useState<{ orderId: string; orderNumber: string } | null>(null)

  const groups = groupByVendor(cart.filter(item => !paidVendors[item.memberId]))

  function handleVendorPaid(memberId: string, orderNumber: string, orderId: string) {
    cart.filter(item => item.memberId === memberId).forEach(item => removeFromCart(item.id))
    setPaidVendors(prev => ({ ...prev, [memberId]: { orderNumber, orderId } }))
    setDeliveryModal({ orderId, orderNumber })
  }

  const allDone = groups.length === 0 && Object.keys(paidVendors).length > 0

  if (cart.length === 0 && Object.keys(paidVendors).length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/browse" className="text-sm font-medium text-indigo-700 hover:underline">
          &larr; Back to browse
        </Link>
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-base text-stone-500">Your cart is empty.</p>
          <Link
            href="/browse"
            className="mt-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Browse members
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {deliveryModal && (
        <DeliveryRequestModal
          orderId={deliveryModal.orderId}
          orderNumber={deliveryModal.orderNumber}
          onClose={() => setDeliveryModal(null)}
          onDeliveryRequested={() => setDeliveryModal(null)}
        />
      )}

      <Link href="/cart" className="text-sm font-medium text-indigo-700 hover:underline">
        &larr; Back to cart
      </Link>

      <h1 className="mt-6 text-xl font-semibold text-stone-900">Checkout</h1>
      <p className="mt-1 text-sm text-stone-500">
        Items are grouped by vendor. Each vendor is paid separately.
      </p>

      {allDone ? (
        <div className="mt-10 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-lg font-semibold text-green-800">All payments complete!</p>
          <div className="mt-3 space-y-1">
            {Object.entries(paidVendors).map(([_, v]) => (
              <p key={v.orderId} className="text-sm text-green-700">Order {v.orderNumber} placed</p>
            ))}
          </div>
          <Link
            href="/browse"
            className="mt-5 inline-block rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Browse more
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {Object.entries(paidVendors).map(([_, v]) => (
            <div key={v.orderId} className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700">
              Order {v.orderNumber} — paid successfully
            </div>
          ))}
          {groups.map(group => (
            <VendorCheckoutCard key={group.memberId} group={group} onVendorPaid={handleVendorPaid} />
          ))}
        </div>
      )}
    </div>
  )
}
