'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Search, X, Loader2 } from 'lucide-react'
import { MatchCard } from './MatchCard'
import { demoMatches } from '@/lib/demo-match'
import type { MatchCandidate, Member } from '@/lib/types'

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
  browseWhenEmpty = false,
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
  /** When true, show a browsable member list before any search, paginated with
   *  a "Load more" button — instead of just the already-picked people. */
  browseWhenEmpty?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MatchCandidate[]>([])
  const [searching, setSearching] = useState(false)
  // Browse-before-search list (only when browseWhenEmpty). Backed by the shared
  // SWR "/api/directory" key so it's cached across mounts (opening the Add view
  // again doesn't refetch) and deduped with the home/explore directory.
  const BROWSE_PAGE = 20
  const [browseVisible, setBrowseVisible] = useState(BROWSE_PAGE)
  const { data: dir, isLoading: dirLoading } = useSWR<{ members?: Member[] }>(
    browseWhenEmpty && !demo ? '/api/directory' : null,
  )
  const browse = useMemo<MatchCandidate[]>(() => {
    if (!browseWhenEmpty) return []
    if (demo) return demoMatches('', 50)
    return (dir?.members ?? [])
      .map((m) => {
        const p = (m.profile ?? {}) as Record<string, unknown>
        return {
          id: m.id,
          name: String(p.name ?? p.businessName ?? ''),
          memberType: p.memberType as string | undefined,
          city: p.city as string | undefined,
          neighborhood: p.neighborhood as string | undefined,
          category: p.category as string | undefined,
          reasons: [],
          profile: m.profile,
        } as MatchCandidate
      })
      .filter((c) => c.id && c.name)
  }, [browseWhenEmpty, demo, dir])
  const browseLoading = browseWhenEmpty && !demo && dirLoading && !dir
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
  // Empty-state list: a browsable directory (paginated) when browseWhenEmpty, else
  // just the people already picked. Picked items stay pinned on top so a pick made
  // while browsing never scrolls out of view.
  const browseFiltered = browse.filter((c) => c.id !== memberId && !excludeIds?.has(c.id))
  const browseSlice = browseFiltered.slice(0, browseVisible)
  const pickedPinned = [...picked.values()].filter(
    (c) => c.id !== memberId && !browseSlice.some((b) => b.id === c.id),
  )
  const shown = isSearching
    ? results.filter(
        (c) => c.id !== memberId && !excludeIds?.has(c.id) && (!picked.has(c.id) || confirming.has(c.id)),
      )
    : browseWhenEmpty
      ? [...pickedPinned, ...browseSlice]
      : [...picked.values()].filter((c) => c.id !== memberId)
  const canLoadMore = !isSearching && browseWhenEmpty && browseFiltered.length > browseVisible

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

      {searching || (browseWhenEmpty && !isSearching && browseLoading && browse.length === 0) ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {searching ? 'Searching…' : 'Loading…'}
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
            // Browsing (empty query, browse mode): toggle picks/drops in place —
            // no confirm-then-drop dance, since the row stays in the list.
            const handleToggle = isSearching
              ? () => pick(c)
              : browseWhenEmpty
                ? () => onToggle(c)
                : () => drop(c)
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
                  onToggle={handleToggle}
                />
              </div>
            )
          })}

          {canLoadMore && (
            <button
              type="button"
              onClick={() => setBrowseVisible((n) => n + BROWSE_PAGE)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  )
}
