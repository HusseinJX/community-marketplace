'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth, SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { CheckCircle, Phone, MapPin, Loader2 } from 'lucide-react'

interface MemberProfile {
  name?: string
  businessName?: string
  memberType?: string
}

interface MemberData {
  id: string
  status?: string
  profile?: MemberProfile
}

type Step = 'loading' | 'sign-in' | 'verify' | 'confirming' | 'success' | 'error'
type Method = 'phone' | 'google_maps'

export default function ClaimPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { isLoaded, isSignedIn, userId } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<Step>('loading')
  const [member, setMember] = useState<MemberData | null>(null)
  const [method, setMethod] = useState<Method | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://community-connector-agent.netlify.app'

  // Load member data
  useEffect(() => {
    if (!memberId) return
    fetch(`${API_BASE}/.netlify/functions/marketplace-member?id=${memberId}`)
      .then(r => r.json())
      .then(d => {
        setMember(d.member ?? null)
      })
      .catch(() => setMember(null))
  }, [memberId, API_BASE])

  // Determine step once auth + member are loaded
  useEffect(() => {
    if (!isLoaded || !member) return
    if (!isSignedIn) {
      setStep('sign-in')
    } else {
      setStep('verify')
    }
  }, [isLoaded, isSignedIn, member])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!method || !value.trim()) return
    setError(null)
    setStep('confirming')

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, method, value: value.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStep('verify')
        return
      }

      if (!data.verified) {
        setError("We couldn't verify ownership with the information provided. Please try a different method.")
        setStep('verify')
        return
      }

      setStep('success')
    } catch {
      setError('Network error. Please try again.')
      setStep('verify')
    }
  }

  const displayName = member?.profile?.businessName || member?.profile?.name || 'this business'

  if (step === 'loading' || !isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    )
  }

  if (step === 'sign-in') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-50 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-stone-900">Sign in to claim</h1>
          <p className="mt-2 text-sm text-stone-500">
            Create an account or sign in to claim <span className="font-medium text-stone-800">{displayName}</span>.
          </p>
        </div>
        <SignIn
          routing="hash"
          forceRedirectUrl={`/claim/${memberId}`}
        />
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold text-stone-900">Profile claimed!</h1>
          <p className="mt-2 text-sm text-stone-500">
            You now own <span className="font-medium text-stone-800">{displayName}</span>.
            Set up your vendor account to start receiving payments and managing your profile.
          </p>
          <button
            onClick={() => router.push('/vendor/setup')}
            className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
          >
            Go to vendor setup
          </button>
          <Link href={`/members/${memberId}`} className="mt-3 block text-sm text-stone-400 hover:text-stone-700">
            View profile
          </Link>
        </div>
      </div>
    )
  }

  // step === 'verify' | 'confirming'
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        <Link href={`/members/${memberId}`} className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
          ← Back to profile
        </Link>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-stone-900">Claim {displayName}</h1>
          <p className="mt-2 text-sm text-stone-500">
            Verify that you own this business. Choose a verification method below.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Method selector */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Verification method</p>
              <button
                type="button"
                onClick={() => { setMethod('phone'); setValue('') }}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                  method === 'phone'
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <Phone className="h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-medium text-stone-900 text-sm">Verify by phone</p>
                  <p className="text-xs text-stone-500 mt-0.5">Enter the phone number listed on this profile</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setMethod('google_maps'); setValue('') }}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                  method === 'google_maps'
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <MapPin className="h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-medium text-stone-900 text-sm">Verify by Google Maps listing</p>
                  <p className="text-xs text-stone-500 mt-0.5">Enter your Google Maps URL or Place ID</p>
                </div>
              </button>
            </div>

            {/* Value input */}
            {method && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">
                  {method === 'phone' ? 'Phone number' : 'Google Maps URL or Place ID'}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={method === 'phone' ? '+1 (555) 000-0000' : 'https://maps.google.com/... or ChIJ...'}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={!method || !value.trim() || step === 'confirming'}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {step === 'confirming' && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 'confirming' ? 'Verifying…' : 'Verify ownership'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-stone-400">
            Signed in as <span className="font-medium">{userId}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
