'use client'

import { ArrowDown, ArrowUp, Lightbulb, Lock, MessageSquare, Minus, Star, Wand2 } from 'lucide-react'
import { GBP, ORGANIC_WEEKS, QUERIES, SITE_ISSUES, type IssueSeverity } from '@/lib/growth-demo-seo'
import { compact, pct } from '@/lib/growth-demo'
import { PositionBar, WeeklyBars } from './GrowthCharts'
import { SectionHeading, Stat } from './ui'

const SEVERITY: Record<IssueSeverity, { label: string; tone: string }> = {
  high: { label: 'Costing you money', tone: 'bg-rose-50 text-rose-700' },
  medium: { label: 'Worth fixing', tone: 'bg-amber-50 text-amber-700' },
  low: { label: 'Tidy-up', tone: 'bg-stone-100 text-stone-600' },
}

/**
 * The unpaid half. For most local businesses this is the larger number and the
 * one nobody is managing — which is why it sits beside the ads rather than
 * under a separate product.
 */
export function SearchPanel() {
  const totalClicks = ORGANIC_WEEKS.reduce((s, w) => s + w.clicks, 0)
  const totalImpr = ORGANIC_WEEKS.reduce((s, w) => s + w.impressions, 0)
  const first = ORGANIC_WEEKS[0].clicks
  const last = ORGANIC_WEEKS[ORGANIC_WEEKS.length - 1].clicks

  return (
    <div className="space-y-10">
      {/* ── Organic overview ─────────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Clicks from search" value={compact(totalClicks)} sub="last 12 weeks" change={(last - first) / first} />
          <Stat label="Times you appeared" value={compact(totalImpr)} sub="impressions" />
          <Stat label="Click-through" value={pct(totalClicks / totalImpr, 1)} sub="across all queries" />
          <Stat
            label="Queries on page one"
            value={`${QUERIES.filter(q => q.position <= 10).length} of ${QUERIES.length}`}
            sub="tracked terms"
          />
        </div>
        <div className="card-soft mt-3 p-4 sm:p-5">
          <SectionHeading title="Clicks per week" hint="Unpaid traffic from Google Search." />
          <WeeklyBars values={ORGANIC_WEEKS.map(w => w.clicks)} labels={ORGANIC_WEEKS.map(w => w.week)} />
        </div>
      </section>

      {/* ── Queries ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="What people search before they find you"
          hint="Last 28 days, sorted by how many people saw you — the ones near the top with a bad position are where the money is."
        />
        <div className="card-soft divide-y divide-stone-100">
          {QUERIES.map(q => {
            const moved = q.priorPosition - q.position
            return (
              <div key={q.query} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="t-strong text-stone-900">{q.query}</span>
                  <div className="flex items-baseline gap-4">
                    <span className="t-fine tabular-nums text-stone-500">{compact(q.impressions)} seen</span>
                    <span className="t-fine tabular-nums text-stone-500">{q.clicks} clicks</span>
                    <span className="t-fine tabular-nums text-stone-500">{pct(q.clicks / q.impressions, 1)}</span>
                    <span className="inline-flex w-16 items-baseline justify-end gap-1">
                      <span className="t-meta tabular-nums font-semibold text-stone-900">#{q.position.toFixed(1)}</span>
                      {Math.abs(moved) < 0.15 ? (
                        <Minus className="h-3 w-3 text-stone-300" />
                      ) : moved > 0 ? (
                        <ArrowUp className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-rose-500" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <PositionBar position={q.position} />
                </div>
                {q.opportunity && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-indigo-50/70 px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <p className="t-fine text-indigo-900">{q.opportunity}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Business Profile ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="Your Google Business Profile"
          hint="The panel that appears when someone searches your name. For a local business it is usually seen more than the website."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card-soft p-4 sm:p-5 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <span className="t-strong text-stone-900">Profile completeness</span>
              <span className="t-lead tabular-nums text-stone-900">{GBP.completeness}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${GBP.completeness}%` }} />
            </div>
            <ul className="mt-3 space-y-1">
              {GBP.missing.map(m => (
                <li key={m} className="t-fine flex items-center gap-2 text-stone-500">
                  <span className="inline-block h-1 w-1 rounded-full bg-stone-300" />
                  {m}
                </li>
              ))}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 sm:grid-cols-4">
              <Fact value={compact(GBP.searches30d)} label="profile views" sub="30 days" />
              <Fact value={String(GBP.calls30d)} label="calls" sub="tap to call" />
              <Fact value={String(GBP.directions30d)} label="directions" sub="requests" />
              <Fact value={String(GBP.websiteClicks30d)} label="website taps" sub="from the panel" />
            </div>

            <p className="t-fine mt-4 text-stone-400">
              {GBP.searchSplit.discovery}% of those views came from people searching a category, not your name — they did
              not know you existed. That share is what a profile is for.
            </p>
          </div>

          <div className="card-soft p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="t-lead tabular-nums text-stone-900">{GBP.reviews.average}</span>
              <span className="t-fine text-stone-500">{GBP.reviews.total} reviews</span>
            </div>
            <div className="mt-4 space-y-2">
              <Row label="New this month" value={`${GBP.reviews.newThisMonth}`} />
              <Row label="Unanswered" value={`${GBP.reviews.unanswered}`} warn />
              <Row label="Photos added (90d)" value={`${GBP.photos90d}`} warn />
              <Row label="Last post" value={`${GBP.lastPostDaysAgo} days ago`} warn />
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-indigo-50/70 px-3 py-2">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <p className="t-fine text-indigo-900">
                Replies to all 12 are drafted and waiting in the agent queue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Site health ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="Your website"
          hint="What is stopping the pages you already have from ranking — and from converting the clicks you are paying for."
        />
        <div className="space-y-2">
          {SITE_ISSUES.map(i => (
            <div key={i.id} className="card-soft p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`t-fine rounded-full px-2 py-0.5 font-semibold ${SEVERITY[i.severity].tone}`}>
                  {SEVERITY[i.severity].label}
                </span>
                <span className="t-strong text-stone-900">{i.title}</span>
                {i.fixable === 'agent' ? (
                  <span className="t-fine inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    <Wand2 className="h-3 w-3" /> Agent can fix
                  </span>
                ) : (
                  <span className="t-fine inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-600">
                    <Lock className="h-3 w-3" /> Needs site access
                  </span>
                )}
              </div>
              <p className="t-meta mt-1.5 text-stone-500">{i.detail}</p>
              <p className="t-fine mt-1 text-stone-400">{i.where}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Fact({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div>
      <div className="t-lead tabular-nums text-stone-900">{value}</div>
      <div className="t-fine text-stone-600">{label}</div>
      <div className="t-fine text-stone-400">{sub}</div>
    </div>
  )
}

function Row({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="t-meta text-stone-500">{label}</span>
      <span className={'t-meta tabular-nums font-semibold ' + (warn ? 'text-amber-700' : 'text-stone-900')}>{value}</span>
    </div>
  )
}
