'use client'

import { useCallback, useEffect, useState } from 'react'
import { Shirt, CheckCircle, RefreshCw } from 'lucide-react'

interface Shop {
  id: string
  title: string
  channel: string | null
}

/**
 * Connect a Printify account and import its catalog.
 *
 * Printify issues personal access tokens rather than OAuth, so the vendor
 * pastes one in. The token is written once and never read back — the status
 * call reports only whether one exists.
 */
export function PrintifyCard({ memberId, memberName }: { memberId?: string; memberName?: string } = {}) {
  const [connected, setConnected] = useState(false)
  const [available, setAvailable] = useState(true)
  const [shopId, setShopId] = useState<string | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const refresh = useCallback(() => {
    // memberId is optional: without it the route resolves the signed-in
    // vendor's own member, which is the normal case on this page. It's only
    // passed when an admin is acting on someone's behalf.
    fetch(`/api/vendor/printify${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setConnected(!!d.connected)
        setShopId(d.shopId ?? null)
        setAvailable(d.available !== false)
      })
      .catch(() => {})
  }, [memberId])

  useEffect(refresh, [refresh])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/vendor/printify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, memberName: memberName ?? 'Vendor', ...body }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Something went wrong.')
      return res.ok ? d : null
    } catch {
      setError('Could not reach Printify. Try again shortly.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    const d = await post({ action: 'connect', token: token.trim() })
    if (!d) return
    setToken('')
    setConnected(true)
    setShops(d.shops ?? [])
    setShopId(d.shopId ?? null)
  }

  async function sync() {
    const d = await post({ action: 'sync' })
    if (!d) return
    // Imported as drafts on purpose — say where they went, or the vendor sees
    // "12 imported" and an unchanged shop.
    setResult(
      `${d.imported} new, ${d.updated} updated${d.skipped ? `, ${d.skipped} skipped` : ''} — new ones are waiting in Products, pending your approval.`
    )
  }

  async function disconnect() {
    setBusy(true)
    await fetch(`/api/vendor/printify${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''}`, { method: 'DELETE' })
    setConnected(false)
    setShopId(null)
    setShops([])
    setBusy(false)
  }

  return (
    <div className="card-soft space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shirt className="h-5 w-5 text-stone-400" />
          <div>
            <p className="font-semibold text-stone-900">Print on demand</p>
            <p className="mt-0.5 text-sm text-stone-500">
              Sell merch from your Printify shop. They print it and post it.
            </p>
          </div>
        </div>
        {connected && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" /> Connected
          </span>
        )}
      </div>

      {!available ? (
        <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">
          Print on demand isn&apos;t switched on for the marketplace yet.
        </p>
      ) : !connected ? (
        <div className="space-y-2">
          <label className="block text-sm text-stone-600" htmlFor="printify-token">
            Your Printify API token
          </label>
          <input
            id="printify-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder="Paste it here"
            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
          <p className="text-xs text-stone-400">
            Printify → My Profile → Connections → Generate token. We store it privately and never show it again.
          </p>
          <button
            onClick={connect}
            disabled={busy || !token.trim()}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Connect Printify'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.length > 1 && (
            <label className="block">
              <span className="text-sm text-stone-600">Which shop?</span>
              <select
                value={shopId ?? ''}
                onChange={async (e) => {
                  setShopId(e.target.value)
                  await post({ action: 'shop', shopId: e.target.value })
                }}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Pick one…</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={sync}
              disabled={busy || !shopId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              <RefreshCw className={'h-3.5 w-3.5 ' + (busy ? 'animate-spin' : '')} />
              {busy ? 'Importing…' : 'Import products'}
            </button>
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {result && <p className="text-sm text-emerald-700">{result}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <p className="text-xs text-stone-400">
        Postage is worked out from the customer&apos;s address at checkout and paid to you with the order,
        since Printify bills you for printing and postage. Disconnecting leaves your imported products alone.
      </p>
    </div>
  )
}
