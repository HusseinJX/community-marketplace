'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  name: string
  city?: string
  type?: string
}

export default function MemberSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'https://community-connector-agent.netlify.app'
      const url = new URL('/.netlify/functions/marketplace-members', base)
      url.searchParams.set('search', query)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.members ?? [])
    } catch {
      setError('Search failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function claim(member: Member) {
    setClaiming(member.id)
    setError(null)
    try {
      const res = await fetch('/api/vendor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      })
      if (!res.ok) throw new Error('Failed to link profile')
      router.push('/vendor')
      router.refresh()
    } catch {
      setError('Failed to link profile. Try again.')
      setClaiming(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search by business name…"
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <button
          onClick={search}
          disabled={loading}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {results.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-stone-900">{m.name}</p>
                {m.city && <p className="text-xs text-stone-500">{m.city}</p>}
              </div>
              <button
                onClick={() => claim(m)}
                disabled={claiming === m.id}
                className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {claiming === m.id ? 'Linking…' : 'This is me'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {results.length === 0 && query && !loading && (
        <p className="text-sm text-stone-500">No members found. Try a different name.</p>
      )}
    </div>
  )
}
