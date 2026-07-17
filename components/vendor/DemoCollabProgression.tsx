'use client'

import { useEffect, useState } from 'react'
import {
  Send, Check, MessageSquare, Users, ListChecks, CalendarPlus,
  ChevronLeft, ChevronRight, RotateCcw, X, type LucideIcon,
} from 'lucide-react'

// Admin-demo only: a click-through walkthrough of how a collaboration comes
// together, so someone in the demo can step through the lifecycle instead of
// guessing it from static cards. Manual — you tap Next to reveal each step.
// Uses the same demo cast as the collab list (Night Market). No backend.

type Stage = {
  key: string
  Icon: LucideIcon
  title: string
  body: React.ReactNode
}

const CHAT = [
  { mine: true, name: 'You', text: 'Thinking a night market on Valencia — food, art, live music.' },
  { mine: false, name: 'Dani Cruz', text: "I'm in! I'll do a live mural wall." },
  { mine: false, name: 'El Tri Cantina', text: "We'll run a taco + agua fresca stand 🌮" },
]

const PLAN = [
  { label: 'What', value: 'Neighborhood Night Market' },
  { label: 'When', value: 'Sat · 5–10pm' },
  { label: 'Where', value: 'Valencia St (500 block)' },
  { label: 'Dani Cruz', value: 'Live mural wall' },
  { label: 'El Tri Cantina', value: 'Taco + agua fresca stand' },
]

const STAGES: Stage[] = [
  {
    key: 'invite',
    Icon: Send,
    title: 'Invite sent',
    body: 'You invited Dani Cruz, El Tri Cantina, and Greenhouse Project to team up on a Neighborhood Night Market.',
  },
  {
    key: 'chat',
    Icon: MessageSquare,
    title: 'Collaboration chat created',
    body: 'Dani Cruz and El Tri Cantina accepted — which simply opens a shared chat for the group. Accepting isn’t a commitment yet; it’s just where the conversation starts.',
  },
  {
    key: 'discuss',
    Icon: Users,
    title: 'Everyone talks it through',
    body: (
      <div className="space-y-2">
        <p>This is where people actually say “I’m in” and shape the idea together — one thread, no side chats.</p>
        <div className="space-y-1.5">
          {CHAT.map((m, i) => (
            <div key={i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  'max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug ' +
                  (m.mine ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-800')
                }
              >
                {!m.mine && <span className="block text-[10px] font-semibold text-stone-400">{m.name}</span>}
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'plan',
    Icon: ListChecks,
    title: 'A plan everyone agrees on',
    body: (
      <div className="space-y-2">
        <p>The chat turns into a structured plan — who’s doing what, when, and where — and everyone approves it.</p>
        <div className="space-y-1 rounded-xl border border-stone-200 bg-white p-2.5">
          {PLAN.map((r) => (
            <div key={r.label} className="flex items-start gap-2 text-[12px]">
              <span className="w-24 shrink-0 font-medium text-stone-400">{r.label}</span>
              <span className="min-w-0 flex-1 text-stone-800">{r.value}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-1.5 border-t border-stone-100 pt-2 text-[12px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Approved by everyone who’s in
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'event',
    Icon: CalendarPlus,
    title: 'Event created & posted',
    body: 'With the plan agreed, the Neighborhood Night Market is created and posted publicly — Sat 5pm, Valencia St — ready for people to attend.',
  },
]

const DISMISS_KEY = 'wl_collab_howto_dismissed'

export function DemoCollabProgression() {
  const [active, setActive] = useState(0)
  // Once you've got it, it stays gone (per device).
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
    } catch {
      /* private mode → just show it */
    }
    setHydrated(true)
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* non-fatal — it'll come back next load */
    }
  }

  // Wait for the localStorage read so a dismissed card doesn't flash on load.
  if (!hydrated || dismissed) return null

  const atStart = active === 0
  const atEnd = active >= STAGES.length - 1
  const stage = STAGES[active]

  return (
    <div className="card-soft relative overflow-hidden p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 pr-8">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          How a collaboration comes together
        </h3>
        <p className="mt-0.5 text-[12px] text-stone-500">Tap through each step.</p>
      </div>

      {/* Stepper — dots for each stage, filled up to the active one; tap to jump. */}
      <div className="mb-4 flex items-center">
        {STAGES.map((s, i) => {
          const reached = i <= active
          const Icon = s.Icon
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <button
                onClick={() => setActive(i)}
                aria-label={s.title}
                className={
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition ' +
                  (reached
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-stone-200 bg-white text-stone-300')
                }
              >
                <Icon className="h-4 w-4" />
              </button>
              {i < STAGES.length - 1 && (
                <div className={'mx-1.5 h-0.5 flex-1 rounded ' + (i < active ? 'bg-indigo-600' : 'bg-stone-200')} />
              )}
            </div>
          )
        })}
      </div>

      {/* Active stage detail. */}
      <div key={stage.key} className="rounded-xl bg-stone-50 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <stage.Icon className="h-4 w-4 text-indigo-600" />
          {stage.title}
        </p>
        <div className="text-[13px] leading-snug text-stone-600">{stage.body}</div>
      </div>

      {/* Manual navigation — nothing advances on its own. */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          disabled={atStart}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-stone-500 transition hover:text-stone-800 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <span className="text-[11px] font-medium text-stone-400">
          {active + 1} / {STAGES.length}
        </span>

        {atEnd ? (
          <button
            onClick={() => setActive(0)}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-2 text-[13px] font-semibold text-stone-700 transition hover:bg-stone-200"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        ) : (
          <button
            onClick={() => setActive((a) => Math.min(STAGES.length - 1, a + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
