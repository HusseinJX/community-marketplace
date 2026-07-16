'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2 } from 'lucide-react'

// Simple password gate for the /joindemo walkthrough. On success the server sets
// an httpOnly cookie and we refresh — the page then renders the demo flow.
export function JoinDemoGate() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/joindemo/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setErr('Wrong password.')
        setBusy(false)
        return
      }
      router.refresh()
    } catch {
      setErr('Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
        <Lock className="h-6 w-6 text-stone-600" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-stone-900">Join demo</h1>
      <p className="mt-2 text-sm text-stone-500">
        A repeatable walkthrough of onboarding — real Google search, no real codes, nothing saved.
        Enter the demo password to continue.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Demo password"
          autoFocus
          className="h-12 w-full rounded-xl border border-stone-200 px-4 text-center text-base"
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enter demo
        </button>
      </form>
    </div>
  )
}
