'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, CheckCircle, AlertTriangle } from 'lucide-react'

interface Service {
  variationId: string
  name: string
  durationMinutes: number
}

/**
 * Connect Square Appointments so the Book button offers real openings.
 *
 * Without this, every business gets request-to-book: the customer suggests a
 * time and the owner replies. With it, the times shown are genuinely free and
 * picking one books it — the only place in the app where availability is real,
 * because it's the only place we have the diary.
 */
export function SquareBookingsCard({ memberId }: { memberId?: string } = {}) {
  const [connected, setConnected] = useState(false)
  const [available, setAvailable] = useState(true)
  const [env, setEnv] = useState<'production' | 'sandbox'>('production')
  const [services, setServices] = useState<Service[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qs = memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''

  const refresh = useCallback(() => {
    fetch(`/api/vendor/square-appointments${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setConnected(!!d.connected)
        setAvailable(d.available !== false)
        setServices(Array.isArray(d.services) ? d.services : [])
        setWarning(d.warning ?? null)
        if (d.env) setEnv(d.env)
      })
      .catch(() => {})
  }, [qs])

  useEffect(refresh, [refresh])

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/vendor/square-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action: 'connect', token: token.trim(), env }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Could not connect.')
      else {
        setToken('')
        setConnected(true)
        refresh()
      }
    } catch {
      setError('Could not reach Square.')
    }
    setBusy(false)
  }

  async function disconnect() {
    setBusy(true)
    await fetch(`/api/vendor/square-appointments${qs}`, { method: 'DELETE' })
    setConnected(false)
    setServices([])
    setBusy(false)
  }

  return (
    <div className="card-soft space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-stone-400" />
          <div>
            <p className="font-semibold text-stone-900">Square Appointments</p>
            <p className="mt-0.5 text-sm text-stone-500">
              Show your real openings so customers can book instantly.
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
        <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">Not switched on yet.</p>
      ) : !connected ? (
        <div className="space-y-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder="Square access token"
            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span>Environment</span>
            {(['production', 'sandbox'] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEnv(e)}
                className={
                  'rounded-md border px-2 py-1 font-medium transition ' +
                  (env === e ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-stone-200 text-stone-600')
                }
              >
                {e}
              </button>
            ))}
          </div>
          {/* The predictable failure, said before it happens. All four scopes,
              not just the obvious two: availability is read from the
              CATALOG (service variations), and Square requires a customer on a
              booking, so we create one. Listing only APPOINTMENTS_* would send
              vendors back for a second token. */}
          <p className="text-xs text-stone-400">
            The token needs <strong>Appointments read &amp; write</strong>, plus{' '}
            <strong>Items read</strong> (to find your bookable services) and{' '}
            <strong>Customers write</strong> (Square requires a customer on every booking).
            The Square connection used for catalog syncing doesn&apos;t have these — this is a
            separate token.
          </p>
          <button
            onClick={connect}
            disabled={busy || !token.trim()}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Connect'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {env === 'sandbox' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Connected to Square&apos;s <strong>sandbox</strong> — bookings made here are not real.
            </p>
          )}
          {services.length > 0 ? (
            <div>
              <p className="text-xs text-stone-500">Bookable services</p>
              <ul className="mt-1 space-y-1">
                {services.map((s) => (
                  <li key={s.variationId} className="text-sm text-stone-800">
                    {s.name} <span className="text-stone-400">· {s.durationMinutes} min</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning ?? 'No bookable services found in this Square account yet.'}</span>
            </p>
          )}
          <button
            onClick={disconnect}
            disabled={busy}
            className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <p className="text-xs text-stone-400">
        Without this, customers suggest a time and you reply. Disconnecting leaves existing
        bookings alone.
      </p>
    </div>
  )
}
