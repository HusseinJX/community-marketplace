'use client'

import { useEffect, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { MatchCard } from './MatchCard'
import { demoMatches } from '@/lib/demo-match'
import type { MatchCandidate } from '@/lib/types'

// The ONE way to pick people — shared by the collaboration composer and the
// organizer lineup so both behave identically:
//   · type to search the semantic matcher
//   · clear to fall back to just the people you've picked
//   · picking/dropping animate in place (the row confirms, then leaves) rather
//     than blinking out of existence
// No nested scroll area: it flows with the page, which is what makes it work on
// a phone.
export function PeoplePicker({
  memberId,
  isAdmin,
  demo = false,
  picked,
  onToggle,
  excludeIds,
  sentIds,
  sentLabel = 'Invited',
  placeholder = 'Search people — “muralist for a launch night”',
  emptyHint = 'Search above to add people.',
}: {
  memberId: string
  isAdmin: boolean
  demo?: boolean
  /** The selected set — owned by the parent, which submits it. */
  picked: Map<string, MatchCandidate>
  onToggle: (c: MatchCandidate) => void
  excludeIds?: Set<string>
  /** Already invited → shown disabled, not selectable. */
  sentIds?: Set<string>
  sentLabel?: string
  placeholder?: string
  emptyHint?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MatchCandidate[]>([])
  const [searching, setSearching] = useState(false)
  // Rows mid-animation: `confirming` = just picked (held in the search list until
  // the check pops), `leaving` = just dropped (held until it fades out).
  const [confirming, setConfirming] = useState<Set<string>>(new Set())
  const [leaving, setLeaving] = useState<Set<string>>(new Set())

  // Debounced semantic search. Empty query → no results, so the list below falls
  // back to the people already selected.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    let alive = true
    setSearching(true)
    const t = setTimeout(async () => {
      if (demo) {
        if (alive) {
          setResults(demoMatches(q))
          setSearching(false)
        }
        return
      }
      try {
        const res = await fetch('/api/vendor/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'semantic', query: q, memberId: isAdmin ? memberId : undefined }),
        })
        const d = await res.json().catch(() => ({}))
        if (alive) setResults(Array.isArray(d.candidates) ? d.candidates : [])
      } catch {
        if (alive) setResults([])
      } finally {
        if (alive) setSearching(false)
      }
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, demo, isAdmin, memberId])

  // Pick from search: add now, then let the row confirm before it drops out.
  function pick(c: MatchCandidate) {
    onToggle(c)
    setConfirming((s) => new Set(s).add(c.id))
    setTimeout(() => {
      setConfirming((s) => {
        const n = new Set(s)
        n.delete(c.id)
        return n
      })
    }, 700)
  }

  // Drop from the selected list: animate first, THEN tell the parent — so the
  // row keeps its place (and its checkmark to shrink) while it leaves.
  function drop(c: MatchCandidate) {
    if (leaving.has(c.id)) return
    setLeaving((s) => new Set(s).add(c.id))
    setTimeout(() => {
      onToggle(c)
      setLeaving((s) => {
        const n = new Set(s)
        n.delete(c.id)
        return n
      })
    }, 550)
  }

  const isSearching = query.trim().length > 0
  const shown = isSearching
    ? results.filter(
        (c) => c.id !== memberId && !excludeIds?.has(c.id) && (!picked.has(c.id) || confirming.has(c.id)),
      )
    : [...picked.values()].filter((c) => c.id !== memberId)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-16 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {searching ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching…
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">
          {isSearching ? 'No matches — try different words.' : emptyHint}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((c) => {
            const joining = confirming.has(c.id)
            const going = leaving.has(c.id)
            const already = sentIds?.has(c.id)
            return (
              <div
                key={c.id}
                className={joining ? 'animate-pick-confirm' : going ? 'animate-unpick-confirm' : undefined}
              >
                <MatchCard
                  candidate={c}
                  selected={picked.has(c.id)}
                  justSelected={joining}
                  justUnselected={going}
                  disabled={already}
                  disabledLabel={sentLabel}
                  onToggle={() => (isSearching ? pick(c) : drop(c))}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
