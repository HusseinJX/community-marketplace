'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingCart, CheckCircle, Truck, PackageCheck, XCircle, Clock, ExternalLink } from 'lucide-react'

interface OrderItem {
  name: string
  qty: number
  price_cents: number
}

interface Order {
  id: string
  order_number: string
  status: string
  items: OrderItem[]
  subtotal_cents: number
  delivery_requested: boolean
  delivery_fee_cents: number | null
  uber_tracking_url: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  paid: { label: 'Paid', color: 'bg-amber-50 text-amber-700', icon: <Clock className="h-3.5 w-3.5" /> },
  ready: { label: 'Ready', color: 'bg-blue-50 text-blue-700', icon: <PackageCheck className="h-3.5 w-3.5" /> },
  dispatched: { label: 'Dispatched', color: 'bg-indigo-50 text-indigo-700', icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  refunded: { label: 'Refunded', color: 'bg-stone-100 text-stone-500', icon: <XCircle className="h-3.5 w-3.5" /> },
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchOrders = useCallback(() => {
    fetch('/api/vendor/orders')
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  async function markReady(order: Order) {
    setUpdating(order.id)
    await fetch('/api/vendor/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, status: 'ready' }),
    })

    // if delivery was requested, dispatch Uber courier
    if (order.delivery_requested) {
      try {
        await fetch('/api/uber/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        })
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'dispatched' } : o))
      } catch {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ready' } : o))
      }
    } else {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ready' } : o))
    }
    setUpdating(null)
  }

  async function markDelivered(order: Order) {
    setUpdating(order.id)
    await fetch('/api/vendor/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, status: 'delivered' }),
    })
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'delivered' } : o))
    setUpdating(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-stone-400 text-sm">
        Loading orders…
      </div>
    )
  }

  return (
    <div className="space-y-8">

      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-indigo-500" />
        <h1 className="text-xl font-semibold text-stone-900">Orders</h1>
        <span className="ml-auto rounded-full bg-stone-100 px-3 py-0.5 text-sm font-medium text-stone-600">
          {orders.length} total
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 py-20 text-center text-stone-400 text-sm">
          No orders yet. They'll appear here once customers check out.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.paid
            return (
              <div key={order.id} className="card-soft p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-stone-900">{order.order_number}</p>
                      {order.delivery_requested && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                          <Truck className="h-3 w-3" />
                          Delivery requested
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.color}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>

                <div className="divide-y divide-stone-100">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-stone-700">
                        {item.name}
                        {item.qty > 1 && <span className="ml-1 text-stone-400">× {item.qty}</span>}
                      </span>
                      <span className="font-medium text-stone-900">{formatCents(item.price_cents * item.qty)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-stone-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-stone-900">
                      Total {formatCents(order.subtotal_cents)}
                    </span>
                    {order.delivery_fee_cents != null && order.delivery_fee_cents > 0 && (
                      <span className="text-sm text-stone-500">
                        Delivery fee: {formatCents(order.delivery_fee_cents)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {order.uber_tracking_url && (
                      <a
                        href={order.uber_tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Track with Uber
                      </a>
                    )}
                    {order.status === 'paid' && (
                      <button
                        onClick={() => markReady(order)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                      >
                        {updating === order.id
                          ? 'Updating…'
                          : order.delivery_requested
                          ? 'Ready — Dispatch Uber'
                          : 'Mark Ready'}
                      </button>
                    )}
                    {order.status === 'dispatched' && (
                      <button
                        onClick={() => markDelivered(order)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        {updating === order.id ? 'Updating…' : 'Confirm Delivered'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
