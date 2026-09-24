'use client'

import { useState } from 'react'
import { BarChart3, Bot, FlaskConical, Plug, Search } from 'lucide-react'
import { DEMO_BUSINESS, PROPOSALS } from '@/lib/growth-demo'
import { AdsPanel } from './AdsPanel'
import { AgentPanel } from './AgentPanel'
import { ConnectionsPanel } from './ConnectionsPanel'
import { OverviewPanel } from './OverviewPanel'
import { SearchPanel } from './SearchPanel'
import { Segmented } from './ui'

type Tab = 'overview' | 'ads' | 'search' | 'agent' | 'connections'

const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'ads', label: 'Ads', Icon: BarChart3 },
  { id: 'search', label: 'Search & profile', Icon: Search },
  { id: 'agent', label: 'Agent', Icon: Bot },
  { id: 'connections', label: 'Connections', Icon: Plug },
]

/**
 * The Growth console — one place a vendor runs their paid ads and their search
 * presence, with an agent doing the work and a queue where they approve it.
 *
 * ⚠️ DEMO. Every number comes from `lib/growth-demo.ts`. No ad account is
 * connected, no API is called, and the buttons change local state and nothing
 * else. It is reachable only by URL and only behind the vendor portal's Clerk
 * gate — deliberately, because a convincing fake dashboard that a real vendor
 * stumbles into is worse than no dashboard.
 *
 * The seam for the real thing: swap the fixture reads for API clients. The
 * panels take plain data and don't know where it came from.
 */
export function GrowthConsole() {
  const [tab, setTab] = useState<Tab>('overview')
  const [days, setDays] = useState(30)

  const pendingCount = PROPOSALS.filter(p => p.status === 'pending').length

  return (
    <div>
      {/* ── The honesty strip. Not dismissible. ──────────────────────────── */}
      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="t-strong text-amber-900">Demo — none of this is a real account.</p>
          <p className="t-fine mt-0.5 text-amber-800">
            Sample data for a fictional bakery, so the screens can be looked at before Google and Meta approve our
            platform access. Nothing here reads or writes a live ad account, and the buttons change what is on this page
            and nothing else.
          </p>
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-title text-stone-900">Growth</h1>
          <p className="t-meta mt-1 text-stone-500">
            {DEMO_BUSINESS.name} · {DEMO_BUSINESS.site}
          </p>
        </div>
        {tab !== 'connections' && tab !== 'agent' && (
          <Segmented
            value={String(days)}
            onChange={v => setDays(Number(v))}
            options={[
              { id: '7', label: '7 days' },
              { id: '30', label: '30 days' },
              { id: '90', label: '90 days' },
            ]}
          />
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-stone-200">
          {TABS.map(t => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={on}
                className={
                  'relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition ' +
                  (on
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800')
                }
              >
                {t.label}
                {t.id === 'agent' && pendingCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'overview' && <OverviewPanel days={days} onGoto={t => setTab(t as Tab)} />}
      {tab === 'ads' && <AdsPanel days={days} />}
      {tab === 'search' && <SearchPanel />}
      {tab === 'agent' && <AgentPanel />}
      {tab === 'connections' && <ConnectionsPanel />}
    </div>
  )
}
