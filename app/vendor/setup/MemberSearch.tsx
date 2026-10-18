'use client'

import { useState } from 'react'
import VerifyOwnership from './VerifyOwnership'

interface Member {
  id: string
  status?: string
  profile?: { name?: string; businessName?: string; city?: string; neighborhood?: string }
}

const nameOf = (m: Member) => m.profile?.businessName || m.profile?.name || 'Unnamed'

export default function MemberSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      // /api/directory does the literal name search; the connector's own
      // `search` param is ignored and returned the first 50 members.
      const res = await fetch(`/api/directory?search=${encodeURIComponent(query.trim())}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.members ?? [])
    } catch {
      setError('Search failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (selected) {
    return (
      <VerifyOwnership
        member={{ id: selected.id, name: nameOf(selected) }}
        onBack={() => setSelected(null)}
      />
    )
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
                <p className="text-sm font-medium text-stone-900">{nameOf(m)}</p>
                {(m.profile?.neighborhood || m.profile?.city) && (
                  <p className="text-xs text-stone-500">{m.profile?.neighborhood || m.profile?.city}</p>
                )}
              </div>
              {/* Only an explicitly unclaimed page can take a code — the
                  send route refuses anything else, so don't offer it. */}
              {m.status === 'unclaimed' ? (
                <button
                  onClick={() => setSelected(m)}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-700"
                >
                  This is me
                </button>
              ) : (
                <span className="text-xs text-stone-400">Already claimed</span>
              )}
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
