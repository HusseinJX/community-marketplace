'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  name: string
  profile?: {
    businessPhone?: string
    websiteUrl?: string
    instagramHandle?: string
    googleMapsUrl?: string
  }
}

type Method = 'phone' | 'website_email' | 'instagram' | 'gemini'

const METHOD_LABELS: Record<Method, { label: string; placeholder: string; hint: string }> = {
  phone: {
    label: 'Business phone number',
    placeholder: '(310) 555-0100',
    hint: 'Enter the phone number listed for your business on Google Maps or your website.',
  },
  website_email: {
    label: 'Business email on your website',
    placeholder: 'hello@yourbusiness.com',
    hint: "Enter the contact email address that appears on your business website.",
  },
  instagram: {
    label: 'Instagram handle',
    placeholder: '@yourbusiness',
    hint: "Enter your business Instagram handle exactly as it appears on your profile.",
  },
  gemini: {
    label: 'Any business contact point',
    placeholder: 'Phone, email, or @handle',
    hint: "Enter any phone number, email, or Instagram handle publicly listed for your business.",
  },
}

function availableMethods(profile: Member['profile'] = {}): Method[] {
  const methods: Method[] = []
  if (profile.businessPhone || profile.googleMapsUrl) methods.push('phone')
  if (profile.websiteUrl) methods.push('website_email')
  if (profile.instagramHandle) methods.push('instagram')
  methods.push('gemini')
  return methods
}

export default function VerifyOwnership({
  member,
  onBack,
}: {
  member: Member
  onBack: () => void
}) {
  const router = useRouter()
  const methods = availableMethods(member.profile)
  const [selectedMethod, setSelectedMethod] = useState<Method>(methods[0])
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verify() {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/vendor/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, method: selectedMethod, value: value.trim() }),
      })
      const data = await res.json()
      if (data.verified) {
        router.push('/vendor')
        router.refresh()
      } else {
        setError("We couldn't verify ownership with that information. Try a different contact method or double-check what you entered.")
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const meta = METHOD_LABELS[selectedMethod]

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-900">
          ← Back
        </button>
        <h2 className="mt-3 text-lg font-semibold text-stone-900">Verify you own {member.name}</h2>
        <p className="mt-1 text-sm text-stone-500">
          Confirm your identity using a contact point publicly listed for this business.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Verify with</p>
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => { setSelectedMethod(m); setValue(''); setError(null) }}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                selectedMethod === m
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
              }`}
            >
              {m === 'phone' && 'Phone'}
              {m === 'website_email' && 'Website email'}
              {m === 'instagram' && 'Instagram'}
              {m === 'gemini' && 'Other'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700">{meta.label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          placeholder={meta.placeholder}
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <p className="text-xs text-stone-400">{meta.hint}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={verify}
        disabled={loading || !value.trim()}
        className="w-full rounded-xl bg-stone-900 py-3 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Verify ownership'}
      </button>
    </div>
  )
}
