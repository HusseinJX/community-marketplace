'use client'

import { useEffect, useState } from 'react'
import { Plug, RefreshCw, CheckCircle, Store } from 'lucide-react'
import { DeliveryCard } from '@/components/vendor/DeliveryCard'
import { PrintifyCard } from '@/components/vendor/PrintifyCard'
import { SquareBookingsCard } from '@/components/vendor/SquareBookingsCard'
import { StripeConnectCard, type StripeStatus } from '@/components/vendor/StripeConnectCard'

interface Settings {
  composio_connection_id: string | null
  composio_platform: string | null
  delivery_mode?: 'none' | 'self' | 'uber'
  uber_direct_enabled: boolean
  uber_pickup_address: string | null
  uber_pickup_phone: string | null
  self_delivery_fee_cents?: number
  self_delivery_free_over_cents?: number | null
  self_delivery_min_order_cents?: number | null
  self_delivery_zips?: string[] | null
  self_delivery_notes?: string | null
}

export default function VendorIntegrationsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [uberAvailable, setUberAvailable] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<StripeStatus>('none')
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  // Shopify connect needs the vendor's store subdomain up front; reveal an
  // inline field when they pick Shopify.
  const [shopifyOpen, setShopifyOpen] = useState(false)
  const [shopDomain, setShopDomain] = useState('')

  useEffect(() => {
    fetch('/api/vendor/integrations')
      .then(r => r.json())
      .then(d => {
        setSettings(d.settings)
        setUberAvailable(!!d.uberAvailable)
        if (d.stripeStatus) setStripeStatus(d.stripeStatus)
      })
      .finally(() => setLoading(false))
  }, [])

  // Stripe hosted onboarding returns here with ?stripe_connect=success|refresh.
  // Note it (Stripe can take a few minutes to verify) and clean the URL.
  const [stripeReturn, setStripeReturn] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sc = params.get('stripe_connect')
    if (!sc) return
    setStripeReturn(sc)
    window.history.replaceState({}, '', '/vendor/integrations')
  }, [])

  // On-connect: when Composio redirects back with ?connected=<platform>, confirm
  // the OAuth actually completed, then kick off an initial catalog sync. The URL
  // is cleaned first so a refresh doesn't re-fire.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const platform = params.get('connected')
    if (!platform) return
    window.history.replaceState({}, '', '/vendor/integrations')
    ;(async () => {
      setSyncing(true)
      try {
        const res = await fetch('/api/vendor/composio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'finalize', platform }),
        })
        const data = await res.json()
        if (!data.connected) {
          setSyncing(false)
          setSyncResult("That store didn't finish connecting — try again.")
          return
        }
        // Reflect the confirmed connection without a round-trip to GET.
        setSettings(s =>
          s ? { ...s, composio_platform: platform, composio_connection_id: 'connected' } : s
        )
      } catch {
        setSyncing(false)
        setSyncResult('Could not confirm the connection — try again.')
        return
      }
      setSyncing(false)
      syncNow()
    })()
  }, [])

  async function connectPlatform(platform: 'shopify' | 'square', subdomain?: string) {
    setConnecting(platform)
    try {
      const res = await fetch('/api/vendor/composio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', platform, subdomain }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error ?? 'Failed to start connection.')
    } catch {
      alert('Failed to start connection. Try again.')
    }
    setConnecting(null)
  }

  async function syncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/vendor/composio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const data = await res.json()
      if (data.error) {
        setSyncResult(`Error: ${data.error}`)
      } else if (data.triggered) {
        setSyncResult('Sync started — products will refresh shortly')
      } else {
        setSyncResult(`Synced ${data.synced ?? 0} products`)
      }
    } catch {
      setSyncResult('Sync failed — try again')
    }
    setSyncing(false)
  }

  if (loading) {
    return <div className="py-24 text-center text-sm text-stone-400">Loading…</div>
  }

  const isConnected = !!settings?.composio_connection_id
  const platform = settings?.composio_platform

  return (
    <div className="space-y-8">

      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-indigo-500" />
        <h1 className="text-xl font-semibold text-stone-900">Integrations</h1>
      </div>

      {stripeReturn === 'success' && stripeStatus !== 'active' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Stripe is still reviewing</p>
          <p className="mt-1 text-sm text-amber-700">
            You finished the form — Stripe can take a few minutes to verify. Refresh shortly;
            if they need more, use the button below.
          </p>
        </div>
      )}

      {/* Bank first — no payouts, no selling, so it leads. Consolidated here from
          the separate /vendor/payments page so shop, delivery, and bank are one
          place. */}
      <StripeConnectCard status={stripeStatus} />

      {/* Catalog sync card */}
      <div className="card-soft p-4 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-stone-400" />
            <div>
              <p className="font-semibold text-stone-900">Store Catalog</p>
              <p className="text-sm text-stone-500 mt-0.5">
                Sync your Shopify or Square product catalog automatically
              </p>
            </div>
          </div>
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected · {platform}
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            {syncResult && (
              <span className="text-sm text-stone-500">{syncResult}</span>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button
                onClick={() => setShopifyOpen(v => !v)}
                disabled={!!connecting}
                className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition"
              >
                {connecting === 'shopify' ? 'Connecting…' : 'Connect Shopify'}
              </button>
              <button
                onClick={() => connectPlatform('square')}
                disabled={!!connecting}
                className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition"
              >
                {connecting === 'square' ? 'Connecting…' : 'Connect Square'}
              </button>
            </div>

            {shopifyOpen && (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  if (shopDomain.trim()) connectPlatform('shopify', shopDomain.trim())
                }}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3"
              >
                <label className="text-sm text-stone-600">Your Shopify store:</label>
                <div className="flex items-center rounded-md border border-stone-300 bg-white px-2 text-sm">
                  <input
                    autoFocus
                    value={shopDomain}
                    onChange={e => setShopDomain(e.target.value)}
                    placeholder="your-store"
                    className="w-40 py-1.5 outline-none"
                  />
                  <span className="text-stone-400">.myshopify.com</span>
                </div>
                <button
                  type="submit"
                  disabled={!shopDomain.trim() || !!connecting}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {connecting === 'shopify' ? 'Connecting…' : 'Authorize'}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-xs text-stone-400">
          Products sync daily at 3am. Connect your store once — new products and price changes
          appear in your marketplace shop automatically.
        </p>
      </div>

      <SquareBookingsCard />

      <PrintifyCard />

      <DeliveryCard
        // delivery_mode is the source of truth, but rows written before it
        // existed only have the boolean — fall back so those vendors don't
        // see their delivery silently switched off.
        mode={settings?.delivery_mode ?? (settings?.uber_direct_enabled ? 'uber' : 'none')}
        pickupAddress={settings?.uber_pickup_address ?? null}
        pickupPhone={settings?.uber_pickup_phone ?? null}
        uberAvailable={uberAvailable}
        selfFeeCents={settings?.self_delivery_fee_cents ?? 0}
        selfFreeOverCents={settings?.self_delivery_free_over_cents ?? null}
        selfMinOrderCents={settings?.self_delivery_min_order_cents ?? null}
        selfZips={settings?.self_delivery_zips ?? []}
        selfNotes={settings?.self_delivery_notes ?? null}
      />
    </div>
  )
}
