'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Check, Users, MessageSquare, CalendarPlus, Play, type LucideIcon } from 'lucide-react'

// Admin-demo only: a self-playing walkthrough of how a collaboration comes
// together, so someone in the demo can watch the lifecycle instead of guessing
// it from static cards. Uses the same demo cast as the collab list (Night
// Market). No backend — purely illustrative.

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

const STAGES: Stage[] = [
  {
    key: 'invite',
    Icon: Send,
    title: 'Invite sent',
    body: 'You invited Dani Cruz, El Tri Cantina, and Greenhouse Project to team up on a Neighborhood Night Market.',
  },
  {
    key: 'accepted',
    Icon: Check,
    title: 'Accepted',
    body: 'Dani Cruz and El Tri Cantina said “I’m in.” Greenhouse Project is still deciding.',
  },
  {
    key: 'started',
    Icon: Users,
    title: 'Collab started',
    body: 'A shared room opened for everyone who’s in — one thread, no side chats.',
  },
  {
    key: 'planning',
    Icon: MessageSquare,
    title: 'Planning',
    body: (
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
    ),
  },
  {
    key: 'event',
    Icon: CalendarPlus,
    title: 'Event created',
    body: 'Neighborhood Night Market went live — Sat 5pm, Valencia St. The lineup fills from everyone who’s in.',
  },
]

const STEP_MS = 2200

export function DemoCollabProgression() {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!playing) return
    if (active >= STAGES.length - 1) {
      setPlaying(false)
      return
    }
    timer.current = setTimeout(() => setActive((a) => a + 1), STEP_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [active, playing])

  const replay = () => {
    setActive(0)
    setPlaying(true)
  }

  const done = !playing && active >= STAGES.length - 1
  const stage = STAGES[active]

  return (
    <div className="card-soft overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          How a collaboration comes together
        </h3>
        <button
          onClick={replay}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-700"
        >
          <Play className="h-3 w-3" /> {done ? 'Replay' : 'Restart'}
        </button>
      </div>

      {/* Stepper — dots for each stage, filled up to the active one. */}
      <div className="mb-4 flex items-center">
        {STAGES.map((s, i) => {
          const reached = i <= active
          const Icon = s.Icon
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <button
                onClick={() => {
                  setPlaying(false)
                  setActive(i)
                }}
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
    </div>
  )
}
