'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock, Plus, Sparkles, ChevronLeft, Loader2, Users } from 'lucide-react'
import { CollabComposer } from '@/components/vendor/CollabComposer'
import { demoMatches } from '@/lib/demo-match'
import type { MatchCandidate } from '@/lib/types'

// The Create side of the dashboard collabs card.
//
// The For-you / Search tabs live in the collabs BAR (the card header, owned by
// VendorHome) — this just reacts to the mode:
//   · For you → collaboration IDEAS built from your complementary matches;
//               tap one (or "start new") to open the composer, prefilled.
//   · Search  → straight to the composer with the search people-picker.
// The composer is the SHARED CollabComposer — identical to the "New
// collaboration" page reached from Messages.

type Idea = { id: string; title: string; desc: string; people: MatchCandidate[] }
type Seed = { title: string; desc: string; people: MatchCandidate[] }

// Deterministic angle for an idea's title — no AI, just a nudge based on what
// the suggested partners do.
function angleFor(cats: string[]): string {
  const c = cats.join(' ').toLowerCase()
  if (c.includes('art') || c.includes('design') || c.includes('mural')) return 'Pop-up + live art'
  if (c.includes('music')) return 'Live-music night'
  if (c.includes('food') || c.includes('beverage') || c.includes('coffee') || c.includes('cafe')) return 'Weekend food pop-up'
  return 'Neighborhood collab'
}

function buildIdeas(matches: MatchCandidate[]): Idea[] {
  const top = matches.slice(0, 5)
  const ideas: Idea[] = []
  if (top.length >= 2) {
    const pair = top.slice(0, 2)
    ideas.push({
      id: 'idea-pair',
      title: `${angleFor(pair.map((p) => p.category ?? ''))} with ${pair.map((p) => p.name).join(' + ')}`,
      desc:
        Array.from(new Set(pair.flatMap((p) => p.reasons))).slice(0, 2).join(' · ') ||
        'A local team-up that plays to each other’s strengths.',
      people: pair,
    })
  }
  top.slice(top.length >= 2 ? 2 : 0).forEach((m) => {
    ideas.push({
      id: `idea-${m.id}`,
      title: `${angleFor([m.category ?? ''])} with ${m.name}`,
      desc: m.reasons.slice(0, 2).join(' · ') || `Team up with ${m.name}.`,
      people: [m],
    })
  })
  return ideas.slice(0, 4)
}

export function CollabMatchHero({
  memberId,
  isAdmin,
  canInvite,
  demo = false,
  mode = 'for-you',
}: {
  memberId: string
  isAdmin: boolean
  /** Creating is a Basic+ capability; lower tiers see the ideas as a teaser. */
  canInvite: boolean
  /** Admin/preview demo → canned matches, no paid engine call. */
  demo?: boolean
  /** For-you / Search — owned by the collabs bar in VendorHome. */
  mode?: 'for-you' | 'search'
}) {
  const [view, setView] = useState<'ideas' | 'compose'>('ideas')
  const [seed, setSeed] = useState<Seed>({ title: '', desc: '', people: [] })
  const [composeKey, setComposeKey] = useState(0) // remount composer per open → fresh state
  const [msg, setMsg] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null) // → deep-link to its chat
  const [upsell, setUpsell] = useState(false)

  const [ideaMatches, setIdeaMatches] = useState<MatchCandidate[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)

  const excludeIds = useMemo(() => new Set([memberId]), [memberId])
  const showIdeas = mode === 'for-you' && view === 'ideas'

  // Back to the ideas list whenever the bar flips to For you.
  useEffect(() => {
    if (mode === 'for-you') setView('ideas')
  }, [mode])

  // Pull complementary matches to seed the ideas (only while the ideas list is up).
  useEffect(() => {
    if (!showIdeas) return
    let alive = true
    setLoadingIdeas(true)
    const load = async () => {
      if (demo) {
        if (alive) {
          setIdeaMatches(demoMatches())
          setLoadingIdeas(false)
        }
        return
      }
      try {
        const res = await fetch('/api/vendor/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'complementary', memberId: isAdmin ? memberId : undefined }),
        })
        const d = await res.json().catch(() => ({}))
        if (alive) setIdeaMatches(Array.isArray(d.candidates) ? d.candidates : [])
      } catch {
        if (alive) setIdeaMatches([])
      } finally {
        if (alive) setLoadingIdeas(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [showIdeas, demo, isAdmin, memberId])

  const ideas = useMemo(
    () => buildIdeas(ideaMatches.filter((c) => !excludeIds.has(c.id))),
    [ideaMatches, excludeIds],
  )

  function openCompose(s: Seed) {
    if (!canInvite) return setUpsell(true)
    setSeed(s)
    setComposeKey((k) => k + 1)
    setMsg('')
    setView('compose')
  }

  const composer = (
    <CollabComposer
      key={composeKey}
      memberId={memberId}
      isAdmin={isAdmin}
      demo={demo}
      canInvite={canInvite}
      seedTitle={seed.title}
      seedDesc={seed.desc}
      seedPeople={seed.people}
      source="dashboard"
      onDone={({ title, count, occasionId }) => {
        setMsg(`Created “${title}” — ${count} invited.`)
        setCreatedId(occasionId)
        setSeed({ title: '', desc: '', people: [] })
        setComposeKey((k) => k + 1)
        setView('ideas')
      }}
    />
  )

  // Straight into the new collaboration's chat — not the list.
  const sent = msg && (
    <p className="text-[13px] text-stone-500">
      {msg}{' '}
      <Link
        href={`/vendor/messages?tab=collabs${createdId ? `&collab=${encodeURIComponent(createdId)}` : ''}`}
        className="font-semibold text-indigo-600 hover:text-indigo-700"
      >
        Open the chat →
      </Link>
    </p>
  )

  // Search → straight to the composer (searching for people IS the create flow).
  if (mode === 'search') {
    return (
      <section className="space-y-3">
        {sent}
        {composer}
      </section>
    )
  }

  // For you → ideas, then the composer.
  if (view === 'compose') {
    return (
      <section className="space-y-3">
        <button
          onClick={() => setView('ideas')}
          className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ChevronLeft className="h-4 w-4" /> Ideas
        </button>
        {composer}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <button
        onClick={() => openCompose({ title: '', desc: '', people: [] })}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3 py-2.5 text-[13px] font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900"
      >
        <Plus className="h-4 w-4" /> Start a new collaboration
      </button>

      {sent}

      {!canInvite && upsell && (
        <div className="card-soft flex items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
            <Lock className="h-4 w-4 text-stone-500" />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-stone-600">
            Anyone can see the ideas. <span className="font-medium text-stone-900">Creating one starts at Basic.</span>
          </p>
          <Link
            href="/vendor/billing"
            className="shrink-0 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800"
          >
            Upgrade
          </Link>
        </div>
      )}

      <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        <Sparkles className="h-3.5 w-3.5 text-teal-500" /> Ideas for you
      </p>

      {loadingIdeas ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Finding ideas…
        </div>
      ) : ideas.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">No ideas yet — start one above.</p>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <button
              key={idea.id}
              onClick={() => openCompose({ title: idea.title, desc: idea.desc, people: idea.people })}
              className="card-soft card-hover w-full p-4 text-left"
            >
              <p className="text-sm font-semibold text-stone-900">{idea.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-stone-500">{idea.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {idea.people.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
                  >
                    <Users className="h-3 w-3" /> {p.name}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
