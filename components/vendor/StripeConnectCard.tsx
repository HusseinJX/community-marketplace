'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Landmark } from 'lucide-react'

export type StripeStatus = 'none' | 'pending' | 'active'

// The one place a vendor starts (or finishes) Stripe Connect onboarding. Both
// buttons hit the same route: create-account reuses an existing account and just
// mints a fresh link, so "Set up" and "Continue" are the same call.
export function StripeConnectCard({ status }: { status: StripeStatus }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe-connect/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.status === 402) {
        setError('Taking payments is a Pro feature. Upgrade in Plan & billing to continue.')
      } else if (data.onboardingUrl) {
        // Stripe's hosted onboarding — returns to /vendor/integrations when done.
        window.location.href = data.onboardingUrl
        return
      } else {
        setError(data.error ?? 'Could not start setup. Try again.')
      }
    } catch {
      setError('Could not start setup. Try again.')
    }
    setBusy(false)
  }

  return (
    <div className="card-soft space-y-5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-5 w-5 text-stone-400" />
          <div>
            <p className="font-semibold text-stone-900">Bank account</p>
            <p className="mt-0.5 text-sm text-stone-500">
              Where your sales get paid out. Handled by Stripe — we never see your bank details.
            </p>
          </div>
        </div>
        {status === 'active' && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" />
            Ready
          </span>
        )}
        {status === 'pending' && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Unfinished
          </span>
        )}
      </div>

      {status === 'active' ? (
        <p className="text-sm text-stone-600">
          You&apos;re set up to take payments. Payouts go to your bank on Stripe&apos;s normal schedule.
        </p>
      ) : (
        <div className="space-y-3">
          <button
            onClick={start}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy
              ? 'Opening Stripe…'
              : status === 'pending'
                ? 'Finish bank setup'
                : 'Set up payouts'}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}

      <p className="text-xs text-stone-400">
        Takes about 5 minutes. You&apos;ll need your bank details and a government ID.
        WhatsLocal takes 5% of each sale.
      </p>
    </div>
  )
}
