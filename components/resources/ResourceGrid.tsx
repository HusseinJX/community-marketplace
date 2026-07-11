'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CATEGORY_META, type Resource, type ResourceCategory } from '@/lib/resources'
import { ResourceCard } from './ResourceCard'

export function ResourceGrid({
  resources,
  recommended = [],
}: {
  resources: Resource[]
  // Resources to rank first (with a "why this fits" reason badge). Order matters —
  // earlier entries sort higher.
  recommended?: { id: string; reasons: string[] }[]
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<ResourceCategory | 'all'>('all')

  // id -> { rank, reasons }. Rank pins recommended cards to the top of the list.
  const recMap = useMemo(() => {
    const m = new Map<string, { rank: number; reasons: string[] }>()
    recommended.forEach((r, i) => m.set(r.id, { rank: i, reasons: r.reasons }))
    return m
  }, [recommended])

  // Only show category chips that actually have resources.
  const categories = useMemo(() => {
    const present = new Set(resources.map((r) => r.category))
    return (Object.keys(CATEGORY_META) as ResourceCategory[]).filter((c) => present.has(c))
  }, [resources])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = resources.filter((r) => {
      if (active !== 'all' && r.category !== active) return false
      if (!q) return true
      const hay = `${r.title} ${r.org} ${r.summary} ${r.description} ${r.tags.join(' ')} ${CATEGORY_META[r.category].label}`.toLowerCase()
      return hay.includes(q)
    })
    // Stable sort: recommended first (in recommendation order), rest keep their
    // original catalog order.
    return matches
      .map((r, i) => ({ r, i }))
      .sort((a, b) => {
        const ra = recMap.get(a.r.id)?.rank ?? Infinity
        const rb = recMap.get(b.r.id)?.rank ?? Infinity
        return ra - rb || a.i - b.i
      })
      .map((x) => x.r)
  }, [resources, query, active, recMap])

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search resources — energy, legal, permits, accessibility…"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Chip label="All" selected={active === 'all'} onClick={() => setActive('all')} />
        {categories.map((c) => (
          <Chip key={c} label={CATEGORY_META[c].label} selected={active === c} onClick={() => setActive(c)} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-400">
          No resources match “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ResourceCard key={r.id} resource={r} reasons={recMap.get(r.id)?.reasons} />
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-full px-3.5 py-1.5 text-xs font-medium transition ' +
        (selected
          ? 'bg-stone-900 text-white'
          : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300')
      }
    >
      {label}
    </button>
  )
}
