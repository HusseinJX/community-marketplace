'use client'

import { useEffect, useState } from 'react'
import { Plug, RefreshCw, CheckCircle, Store } from 'lucide-react'

interface Settings {
  composio_connection_id: string | null
  composio_platform: string | null
  uber_direct_enabled: boolean
}

export default function VendorIntegrationsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/vendor/integrations')
      .then(r => r.json())
      .then(d => setSettings(d.settings))
      .finally(() => setLoading(false))
  }, [])

  async function connectPlatform(platform: 'shopify' | 'square') {
    setConnecting(platform)
    try {
      const res = await fetch('/api/vendor/composio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', platform }),
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
      setSyncResult(data.error ? `Error: ${data.error}` : `Synced ${data.synced ?? 0} products`)
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
      <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />

      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-indigo-500" />
        <h1 className="text-2xl font-semibold text-stone-900">Integrations</h1>
      </div>

      {/* Catalog sync card */}
      <div className="card-soft p-6 space-y-5">
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
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            {syncResult && (
              <span className="text-sm text-stone-500">{syncResult}</span>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => connectPlatform('shopify')}
              disabled={!!connecting}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition"
            >
              {connecting === 'shopify' ? 'Connecting…' : 'Connect Shopify'}
            </button>
            <button
              onClick={() => connectPlatform('square')}
              disabled={!!connecting}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition"
            >
              {connecting === 'square' ? 'Connecting…' : 'Connect Square'}
            </button>
          </div>
        )}

        <p className="text-xs text-stone-400">
          Products sync daily at 3am. Connect your store once — new products and price changes
          appear in your marketplace shop automatically.
        </p>
      </div>
    </div>
  )
}
