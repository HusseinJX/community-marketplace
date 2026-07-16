'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, ChevronDown, ArrowRight, Check } from 'lucide-react'
import { MatchFinder } from '@/components/match/MatchFinder'
import { COLLAB_IDEAS, OPEN_EVENTS, type CollabIdea, type OpenEvent } from '@/lib/demo-ideas'
import type { MatchCandidate } from '@/lib/types'
import { track } from '@/lib/track'

// The wedge, before signup — as IDEAS, not a list of businesses.
//
// A list ("here are 5 complementary matches") leaves the visitor to do the
// creative work: ok… so what do I do with a muralist? The engine's real value is
// the thing they'd never assemble alone — a specific night, the specific people
// in it, why each one is there, and the first three moves. So that's what leads.
// The raw matcher sits underneath for "I already know who I want".
export function BusinessMatchDemo() {
  return (
    <div className="space-y-10">
      {/* Door 1 — start something. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-stone-900">Start something</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-500">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Ideas built from businesses near you — things you wouldn&apos;t have put together yourself.
          </p>
        </div>

        <div className="space-y-3">
          {COLLAB_IDEAS.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      </section>

      {/* Door 2 — join something that already exists. Lower commitment, and
          usually the first collaboration a business ever does: you don't have to
          invent anything, you just have to be the piece they're missing. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-stone-900">Or join something already happening</h2>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Events near you with a gap shaped like your business. Ask to join — the host approves.
          </p>
        </div>

        <div className="space-y-2">
          {OPEN_EVENTS.map((e) => (
            <OpenEventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      <SearchInstead />
    </div>
  )
}

function OpenEventCard({ event }: { event: OpenEvent }) {
  const [asked, setAsked] = useState(false)

  return (
    <div className="card-soft flex items-start gap-3 p-4">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-base">
        {event.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-stone-900">{event.title}</p>
        <p className="mt-0.5 truncate text-xs text-stone-500">
          {event.when} · {event.where} · by {event.host}
        </p>

        {/* The gap — the reason there's room for you. */}
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {event.needs}
        </p>

        {/* Why the matcher put this in front of you. */}
        <p className="mt-1.5 flex items-start gap-1 text-xs text-emerald-700">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          {event.why}
        </p>

        <p className="mt-1 truncate text-xs text-stone-400">Already in: {event.lineup.join(' · ')}</p>
      </div>

      {asked ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-3.5 py-2 text-[13px] font-semibold text-stone-500">
          <Check className="h-3.5 w-3.5" /> Asked
        </span>
      ) : (
        <Link
          href="/join"
          onClick={() => {
            setAsked(true)
            track('opportunity_ask_to_join', { eventId: event.id, source: 'public_businesses' })
          }}
          className="shrink-0 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
        >
          Ask to join
        </Link>
      )}
    </div>
  )
}

function IdeaCard({ idea }: { idea: CollabIdea }) {
  const [open, setOpen] = useState(false)

  return (
    <article className="card-soft overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-stone-900">{idea.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-stone-600">{idea.pitch}</span>

          {/* The lineup, always visible — this IS the idea. */}
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {idea.lineup.map((r) => (
              <span
                key={r.name}
                className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700"
              >
                {r.emoji} {r.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-stone-400">
              {idea.effort}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-stone-100 px-4 pb-4 pt-3">
          {/* Why it works — the insight the matcher is actually selling. */}
          <p className="rounded-xl bg-indigo-50 px-3 py-2.5 text-[13px] leading-snug text-stone-700">
            <span className="font-semibold text-indigo-700">Why this works: </span>
            {idea.insight}
          </p>

          {/* Who's in it, and why each one. */}
          <div className="space-y-2">
            {idea.lineup.map((r) => (
              <div key={r.name} className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-100 text-sm">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-stone-900">{r.name}</p>
                  <p className="text-xs text-stone-500">
                    {r.role} · {r.why}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Planning it — three moves, so it stops feeling abstract. */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              How you&apos;d pull it off
            </p>
            <ol className="mt-1.5 space-y-1">
              {idea.steps.map((s, i) => (
                <li key={s} className="flex gap-2 text-[13px] text-stone-600">
                  <span className="font-semibold text-stone-400">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          <Link
            href="/join"
            onClick={() => track('collab_started', { source: 'public_businesses', idea: idea.id })}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700"
          >
            Start this collaboration
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </article>
  )
}

// Secondary: the raw matcher, for people who already know who they want.
function SearchInstead() {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map())

  function toggle(c: MatchCandidate) {
    setPicked((s) => {
      const n = new Map(s)
      if (n.has(c.id)) n.delete(c.id)
      else n.set(c.id, c)
      return n
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[13px] font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
      >
        Or find a specific business →
      </button>
    )
  }

  return (
    <section className="space-y-3">
      <p className="text-[13px] font-semibold text-stone-900">Find someone specific</p>
      <MatchFinder
        memberId="demo-business"
        isAdmin={false}
        demo
        source="public_businesses"
        selected={new Set(picked.keys())}
        onToggle={toggle}
        placeholder="Describe who you need — “muralist for a launch night”"
      />
      {picked.size > 0 && (
        <div className="card-soft flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1 truncate text-[13px] text-stone-600">
            {[...picked.values()].map((c) => c.name).join(', ')}
          </span>
          <Link
            href="/join"
            onClick={() => track('collab_invite_sent', { count: picked.size, source: 'public_businesses' })}
            className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700"
          >
            Invite {picked.size} →
          </Link>
        </div>
      )}
    </section>
  )
}
