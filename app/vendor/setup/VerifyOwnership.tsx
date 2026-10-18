'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

interface Member {
  id: string
  name: string
}

// Ownership is proved ONE way: a code texted (or read out, for a landline) to
// the number on the business's own listing. Same routes as /join —
// /api/join/verify/send → check → commit — so there is one code path to keep
// honest.
//
// This screen used to offer "type the business phone", "website email",
// "Instagram" and "Other". Each "verified" by matching something printed on
// the listing — copyable by exactly the person you are trying to keep out.
// Its route (/api/vendor/verify) is deleted, not just unlinked.
export default function VerifyOwnership({
  member,
  onBack,
}: {
  member: Member
  onBack: () => void
}) {
  const router = useRouter()
  const { user } = useUser()
  const [phoneHint, setPhoneHint] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  // null = untouched, so the account's name fills in; '' = they cleared it.
  const [name, setName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ownerName = name ?? user?.fullName ?? ''

  async function send(channel: 'sms' | 'call' = 'sms') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/join/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, channel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.sent) throw new Error(data.error || "Couldn't send a code.")
      setPhoneHint(data.phoneHint ?? null)
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send a code.")
    } finally {
      setLoading(false)
    }
  }

  async function confirm() {
    if (code.trim().length < 4) return setError('Enter the 6-digit code.')
    if (!ownerName.trim()) return setError('Add your name.')
    setLoading(true)
    setError(null)
    try {
      const check = await fetch('/api/join/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const checked = await check.json().catch(() => ({}))
      if (!checked.verified) throw new Error(checked.error || "That code didn't match the business's number.")

      const commit = await fetch('/api/join/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: ownerName.trim() }),
      })
      const done = await commit.json().catch(() => ({}))
      if (!commit.ok) throw new Error(done.error || "Couldn't link this page.")
      router.push('/vendor')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const input =
    'w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400'

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-900">
          ← Back
        </button>
        <h2 className="mt-3 text-lg font-semibold text-stone-900">Verify you own {member.name}</h2>
        <p className="mt-1 text-sm text-stone-500">
          We&apos;ll text a code to the phone number on this business&apos;s listing. Whoever answers that phone can link it.
        </p>
      </div>

      {!sent ? (
        <button
          onClick={() => send()}
          disabled={loading}
          className="w-full rounded-xl bg-stone-900 py-3 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Text me a code'}
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Code sent to {phoneHint ?? 'the business number'}.{' '}
            <button onClick={() => send('call')} disabled={loading} className="font-medium text-stone-900 underline disabled:opacity-50">
              Landline? Call instead
            </button>
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
              placeholder="123456"
              className={input}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Your name</label>
            <input value={ownerName} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={input} />
          </div>
          <button
            onClick={confirm}
            disabled={loading || !code.trim()}
            className="w-full rounded-xl bg-stone-900 py-3 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify and link'}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
