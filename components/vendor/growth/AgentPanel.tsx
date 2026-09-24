'use client'

import { useState } from 'react'
import { ArrowRight, Bot, Check, Clock, ShieldCheck, Undo2, X, Zap } from 'lucide-react'
import {
  AUTONOMY,
  GUARDRAILS,
  PROPOSALS,
  type AgentProposal,
  type Autonomy,
  type ProposalKind,
} from '@/lib/growth-demo'
import { SectionHeading } from './ui'

const KIND_LABEL: Record<ProposalKind, string> = {
  budget: 'Budget',
  pause: 'Pause',
  keywords: 'Keywords',
  creative: 'Creative',
  seo: 'Search',
  gbp: 'Profile',
  tracking: 'Tracking',
}

/**
 * The queue. Everything else in this console is a report; this is the only
 * screen where something happens.
 *
 * Three things are deliberate:
 *  · every card states its reasoning in the vendor's own terms, not the
 *    platform's — "it optimises for the click, and the click is not the thing
 *    you sell" rather than "objective mismatch";
 *  · confidence is shown, because a confident wrong answer spends real money;
 *  · approving is undoable for a beat, since the whole trust story is that
 *    nothing is irreversible.
 */
export function AgentPanel() {
  const [autonomy, setAutonomy] = useState<Autonomy>('guarded')
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'dismissed'>>({})

  const pending = PROPOSALS.filter(p => p.status === 'pending')
  const applied = PROPOSALS.filter(p => p.status === 'applied')
  const open = pending.filter(p => !decisions[p.id])
  const decided = pending.filter(p => decisions[p.id])

  const decide = (id: string, d: 'approved' | 'dismissed') =>
    setDecisions(prev => ({ ...prev, [id]: d }))
  const undo = (id: string) =>
    setDecisions(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

  return (
    <div className="space-y-10">
      {/* ── How much rope ────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="How much your agent may do on its own"
          hint="You can move this either way at any time, and every change it makes is logged whichever setting you pick."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {AUTONOMY.map(a => {
            const on = autonomy === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAutonomy(a.id)}
                aria-pressed={on}
                className={
                  'card-soft card-hover p-4 text-left transition ' +
                  (on ? 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-200' : '')
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      'flex h-4 w-4 items-center justify-center rounded-full border ' +
                      (on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-stone-300')
                    }
                  >
                    {on && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="t-strong text-stone-900">{a.label}</span>
                </div>
                <p className="t-fine mt-1.5 text-stone-500">{a.detail}</p>
              </button>
            )
          })}
        </div>

        {autonomy !== 'suggest' && (
          <div className="card-soft mt-3 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-stone-400" />
              <span className="section-label">Limits it cannot cross</span>
            </div>
            <div className="divide-y divide-stone-100">
              {GUARDRAILS.map(g => (
                <div key={g.id} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="t-meta text-stone-600">{g.label}</span>
                  <span className="t-meta shrink-0 font-semibold text-stone-900">{g.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── The queue ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title={`${open.length} waiting for you`}
          hint="Ordered by what the agent expects each one to be worth."
        />
        <div className="space-y-3">
          {open.map(p => (
            <ProposalCard key={p.id} p={p} onDecide={decide} />
          ))}
          {open.length === 0 && (
            <div className="card-soft p-8 text-center">
              <Bot className="mx-auto h-6 w-6 text-stone-300" />
              <p className="t-meta mt-2 text-stone-500">Nothing waiting. The agent checks again every morning.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Decided in this session ──────────────────────────────────────── */}
      {decided.length > 0 && (
        <section>
          <SectionHeading title="Decided just now" />
          <div className="space-y-2">
            {decided.map(p => (
              <div key={p.id} className="card-soft flex items-center gap-3 p-3.5">
                <span
                  className={
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' +
                    (decisions[p.id] === 'approved' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-600')
                  }
                >
                  {decisions[p.id] === 'approved' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span className="t-meta min-w-0 flex-1 truncate text-stone-700">{p.title}</span>
                <span className="t-fine shrink-0 text-stone-400">
                  {decisions[p.id] === 'approved' ? 'Queued to apply' : 'Dismissed'}
                </span>
                <button
                  onClick={() => undo(p.id)}
                  className="t-fine inline-flex shrink-0 items-center gap-1 font-semibold text-stone-500 hover:text-stone-900"
                >
                  <Undo2 className="h-3 w-3" /> Undo
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── What it already did ──────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="What it has already done"
          hint="Changes inside the limits above apply without asking. They all land here."
        />
        <div className="space-y-2">
          {applied.map(p => (
            <div key={p.id} className="card-soft p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-fine inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                  {p.auto ? <Zap className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  {p.auto ? 'Applied automatically' : 'Applied'}
                </span>
                <span className="t-strong text-stone-900">{p.title}</span>
                <span className="t-fine inline-flex items-center gap-1 text-stone-400">
                  <Clock className="h-3 w-3" />
                  {p.appliedAt}
                </span>
              </div>
              <p className="t-meta mt-1.5 text-stone-500">{p.reason}</p>
              <p className="t-fine mt-1 font-semibold text-emerald-700">{p.impact}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ProposalCard({
  p,
  onDecide,
}: {
  p: AgentProposal
  onDecide: (id: string, d: 'approved' | 'dismissed') => void
}) {
  return (
    <div className="card-soft p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-fine rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
          {KIND_LABEL[p.kind]}
        </span>
        <span className="t-fine rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-600">{p.surface}</span>
        <span className="t-fine ml-auto text-stone-400">{Math.round(p.confidence * 100)}% confident</span>
      </div>

      <h3 className="t-lead mt-2 text-stone-900">{p.title}</h3>
      <p className="t-meta mt-1.5 text-stone-600">{p.reason}</p>

      {p.diff && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
          <span className="t-fine text-stone-500 line-through">{p.diff.before}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-stone-400" />
          <span className="t-fine font-semibold text-stone-900">{p.diff.after}</span>
        </div>
      )}

      <p className="t-meta mt-3 font-semibold text-emerald-700">{p.impact}</p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onDecide(p.id, 'approved')}
          className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-700 active:scale-95"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          onClick={() => onDecide(p.id, 'dismissed')}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-4 py-2 text-[13px] font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 active:scale-95"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
