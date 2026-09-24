'use client'

import { ArrowRight, Check, CircleDashed, Sparkles } from 'lucide-react'
import {
  ATTRIBUTION_GRADES,
  CHANNELS,
  PROPOSALS,
  combineSeries,
  compact,
  cpa,
  delta,
  getCampaigns,
  money,
  priorTail,
  roas,
  tail,
  totalsOf,
  type ChannelId,
} from '@/lib/growth-demo'
import { GBP, ORGANIC_WEEKS } from '@/lib/growth-demo-seo'
import { SpendRevenueChart, WeeklyBars } from './GrowthCharts'
import { RoasBadge, SectionHeading, Stat } from './ui'

/**
 * The one screen a vendor would actually open on a Tuesday: is this working,
 * and what does the agent want to do about it.
 */
export function OverviewPanel({ days, onGoto }: { days: number; onGoto: (tab: string) => void }) {
  const campaigns = getCampaigns()
  const now = totalsOf(campaigns.flatMap(c => tail(c.series, days)))
  const before = totalsOf(campaigns.flatMap(c => priorTail(c.series, days)))

  const points = combineSeries(campaigns, days).map(p => ({
    date: p.date,
    spend: p.spendCents / 100,
    revenue: p.revenueCents / 100,
  }))

  const pending = PROPOSALS.filter(p => p.status === 'pending').slice(0, 3)

  // Channel split, so "where is the money going" is answerable without leaving.
  const byChannel = (Object.keys(CHANNELS) as ChannelId[])
    .map(id => ({
      id,
      totals: totalsOf(campaigns.filter(c => c.channel === id).flatMap(c => tail(c.series, days))),
    }))
    .filter(c => c.totals.spendCents > 0)
  const spendMax = Math.max(1, ...byChannel.map(c => c.totals.spendCents))

  return (
    <div className="space-y-10">
      {/* ── How much of this is actually known ───────────────────────────── */}
      <section className="card-soft p-4">
        <div className="t-fine mb-3 flex items-center gap-2 text-stone-500">
          <span className="section-label">How this is measured</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ATTRIBUTION_GRADES.map(g => (
            <div key={g.grade} className="flex gap-2.5">
              <span
                className={
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ' +
                  (g.on ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')
                }
              >
                {g.on ? <Check className="h-2.5 w-2.5" /> : <CircleDashed className="h-2.5 w-2.5" />}
              </span>
              <div>
                <div className="t-strong text-stone-900">
                  {g.grade}
                  <span className="t-fine ml-1.5 font-normal text-stone-500">{g.label}</span>
                </div>
                <p className="t-fine mt-0.5 text-stone-500">{g.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── The four numbers ─────────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Ad spend"
            value={money(now.spendCents)}
            sub={`${money(Math.round(now.spendCents / days))} a day`}
            change={delta(now.spendCents, before.spendCents)}
          />
          <Stat
            label="Attributed revenue"
            value={money(now.revenueCents)}
            sub={`${now.conversions.toFixed(0)} results`}
            change={delta(now.revenueCents, before.revenueCents)}
          />
          <Stat
            label="Return on ad spend"
            value={`${roas(now).toFixed(1)}×`}
            sub={`${money(Math.round(now.revenueCents - now.spendCents))} above spend`}
            change={delta(roas(now), roas(before))}
          />
          <Stat
            label="Cost per result"
            value={money(Math.round(cpa(now)), { decimals: true })}
            sub={`${compact(now.clicks)} clicks`}
            change={delta(cpa(now), cpa(before))}
            inverse
          />
        </div>

        <div className="card-soft mt-3 p-4 sm:p-5">
          <SpendRevenueChart points={points} />
        </div>
      </section>

      {/* ── What the agent wants ─────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="What your agent wants to do"
          hint="Ranked by what it expects each one to be worth. Nothing here has happened yet."
          action={
            <button
              onClick={() => onGoto('agent')}
              className="t-meta inline-flex shrink-0 items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
            >
              All {PROPOSALS.filter(p => p.status === 'pending').length} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="space-y-2">
          {pending.map(p => (
            <button
              key={p.id}
              onClick={() => onGoto('agent')}
              className="card-soft card-hover flex w-full items-start gap-3 p-4 text-left"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <div className="t-strong text-stone-900">{p.title}</div>
                <p className="t-meta mt-1 line-clamp-2 text-stone-500">{p.reason}</p>
                <p className="t-fine mt-1.5 font-semibold text-emerald-700">{p.impact}</p>
              </div>
              <span className="t-fine shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{p.surface}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Two smaller reads ────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-4 sm:p-5">
          <SectionHeading title="Where the money went" />
          <div className="space-y-3">
            {byChannel.map(c => (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="t-strong text-stone-900">{CHANNELS[c.id].label}</span>
                  <span className="t-meta tabular-nums text-stone-500">
                    {money(c.totals.spendCents)} → {money(c.totals.revenueCents)}
                  </span>
                  <RoasBadge value={roas(c.totals)} />
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(c.totals.spendCents / spendMax) * 100}%`,
                      background: CHANNELS[c.id].dot,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="t-fine mt-4 text-stone-400">
            Paid only. Organic and your Business Profile brought {compact(ORGANIC_WEEKS[ORGANIC_WEEKS.length - 1].clicks * 4)} visits
            in the same period at no cost.
          </p>
        </div>

        <div className="card-soft p-4 sm:p-5">
          <SectionHeading title="Free traffic" hint="Organic clicks per week." />
          <WeeklyBars values={ORGANIC_WEEKS.map(w => w.clicks)} labels={ORGANIC_WEEKS.map(w => w.week)} />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <MiniFact label="Profile views" value={compact(GBP.searches30d)} sub="30 days" />
            <MiniFact label="Calls" value={String(GBP.calls30d)} sub="from search" />
            <MiniFact label="Directions" value={String(GBP.directions30d)} sub="from search" />
            <MiniFact label="Reviews waiting" value={String(GBP.reviews.unanswered)} sub="unanswered" />
          </div>
        </div>
      </section>
    </div>
  )
}

function MiniFact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="t-lead tabular-nums text-stone-900">{value}</div>
      <div className="t-fine text-stone-500">{label}</div>
      <div className="t-fine text-stone-400">{sub}</div>
    </div>
  )
}
