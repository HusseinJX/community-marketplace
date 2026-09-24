'use client'

import { useState } from 'react'
import { AlertTriangle, Pause } from 'lucide-react'
import {
  CHANNELS,
  compact,
  cpa,
  cpc,
  ctr,
  getCampaigns,
  money,
  pct,
  roas,
  tail,
  totalsOf,
  type ChannelId,
} from '@/lib/growth-demo'
import { Sparkline } from './GrowthCharts'
import { ChannelChip, RoasBadge, Segmented, Stat } from './ui'

type Filter = 'all' | ChannelId

/**
 * Every campaign across every network in one table.
 *
 * The column that decides everything is return, so it is coloured and the rows
 * are sorted by it — a vendor should be able to see which campaign is losing
 * money without reading a single number.
 */
export function AdsPanel({ days }: { days: number }) {
  const [filter, setFilter] = useState<Filter>('all')
  const all = getCampaigns()
  const campaigns = filter === 'all' ? all : all.filter(c => c.channel === filter)

  const rows = campaigns
    .map(c => ({ c, t: totalsOf(tail(c.series, days)) }))
    .sort((a, b) => roas(b.t) - roas(a.t))

  const totals = totalsOf(rows.flatMap(r => tail(r.c.series, days)))
  const dailyBudget = campaigns.reduce((s, c) => s + (c.status === 'paused' ? 0 : c.dailyBudgetCents), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all' as Filter, label: 'All networks' },
            { id: 'google_ads' as Filter, label: CHANNELS.google_ads.label },
            { id: 'meta_ads' as Filter, label: CHANNELS.meta_ads.label },
          ]}
        />
        <span className="t-fine text-stone-500">
          {money(dailyBudget)}/day budgeted · {campaigns.filter(c => c.status !== 'paused').length} running
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Spend" value={money(totals.spendCents)} />
        <Stat label="Revenue" value={money(totals.revenueCents)} />
        <Stat label="Return" value={`${roas(totals).toFixed(1)}×`} />
        <Stat label="Cost per result" value={money(Math.round(cpa(totals)), { decimals: true })} />
        <Stat label="Click-through" value={pct(ctr(totals), 2)} sub={`${money(Math.round(cpc(totals)), { decimals: true })} a click`} />
      </div>

      {/* Desktop: a real table. Mobile: the same rows as cards — a nine-column
          table inside a horizontal scroller is how vendors stop reading. */}
      <div className="card-soft hidden overflow-hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/60">
              {['Campaign', 'Budget', 'Spend', 'Clicks', 'Results', 'Cost/result', 'Return', 'Trend'].map((h, i) => (
                <th
                  key={h}
                  className={'t-fine px-4 py-2.5 font-semibold text-stone-500 ' + (i === 0 ? '' : 'text-right')}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, t }) => (
              <tr key={c.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ChannelChip channel={c.channel} />
                    <span className="t-strong text-stone-900">{c.name}</span>
                    {c.status === 'limited' && (
                      <span className="t-fine inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Budget-limited {c.budgetCappedPct}% of days
                      </span>
                    )}
                    {c.status === 'paused' && (
                      <span className="t-fine inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-600">
                        <Pause className="h-3 w-3" /> Paused
                      </span>
                    )}
                  </div>
                  <div className="t-fine mt-0.5 text-stone-400">{c.objective}</div>
                </td>
                <td className="t-meta px-4 py-3 text-right tabular-nums text-stone-600">
                  {money(c.dailyBudgetCents, { decimals: true })}/d
                </td>
                <td className="t-meta px-4 py-3 text-right tabular-nums text-stone-900">{money(t.spendCents)}</td>
                <td className="t-meta px-4 py-3 text-right tabular-nums text-stone-600">{compact(t.clicks)}</td>
                <td className="t-meta px-4 py-3 text-right tabular-nums text-stone-600">
                  {t.conversions < 1 ? '0' : t.conversions.toFixed(0)}
                </td>
                <td className="t-meta px-4 py-3 text-right tabular-nums text-stone-600">
                  {t.conversions < 1 ? '—' : money(Math.round(cpa(t)), { decimals: true })}
                </td>
                <td className="px-4 py-3 text-right">
                  <RoasBadge value={roas(t)} />
                </td>
                <td className="px-4 py-3">
                  <Sparkline
                    values={tail(c.series, days).map(d => d.revenueCents)}
                    color={roas(t) >= 1.5 ? '#059669' : '#e11d48'}
                    className="ml-auto h-6 w-20"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 lg:hidden">
        {rows.map(({ c, t }) => (
          <div key={c.id} className="card-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <ChannelChip channel={c.channel} />
                  {c.status === 'limited' && (
                    <span className="t-fine inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> Capped
                    </span>
                  )}
                </div>
                <div className="t-strong text-stone-900">{c.name}</div>
                <div className="t-fine text-stone-400">{c.objective}</div>
              </div>
              <RoasBadge value={roas(t)} />
            </div>
            <div className="mt-3 flex items-baseline gap-4">
              <MiniCell label="Spend" value={money(t.spendCents)} />
              <MiniCell label="Revenue" value={money(t.revenueCents)} />
              <MiniCell label="Results" value={t.conversions < 1 ? '0' : t.conversions.toFixed(0)} />
              <MiniCell label="Budget" value={`${money(c.dailyBudgetCents, { decimals: true })}/d`} />
            </div>
          </div>
        ))}
      </div>

      <p className="t-fine text-stone-400">
        Results and revenue are orders matched back to the click through WhatsLocal link tracking. Platform-reported
        conversions are shown separately once conversion tracking on your own site is fixed.
      </p>
    </div>
  )
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-fine text-stone-400">{label}</div>
      <div className="t-meta tabular-nums font-semibold text-stone-900">{value}</div>
    </div>
  )
}
