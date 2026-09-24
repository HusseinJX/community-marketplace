'use client'

import { AlertCircle, Check, Clock, Plug } from 'lucide-react'
import { ATTRIBUTION_GRADES, CONNECTIONS, type ConnState } from '@/lib/growth-demo'
import { SectionHeading } from './ui'

const STATE: Record<ConnState, { label: string; tone: string; Icon: typeof Check }> = {
  connected: { label: 'Connected', tone: 'bg-emerald-50 text-emerald-700', Icon: Check },
  attention: { label: 'Needs attention', tone: 'bg-amber-50 text-amber-700', Icon: AlertCircle },
  available: { label: 'Not connected', tone: 'bg-stone-100 text-stone-600', Icon: Plug },
}

/**
 * What a vendor links, and what they're handing over when they do.
 *
 * The scopes are listed BEFORE the button on purpose. "Connect Google Ads"
 * without saying "we will be able to change your budgets" is the kind of
 * consent that gets withdrawn angrily three weeks later.
 */
export function ConnectionsPanel() {
  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="Your accounts"
          hint="Link once. After that the agent reads performance and — within the limits you set — makes changes on your behalf."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {CONNECTIONS.map(c => {
            const s = STATE[c.state]
            return (
              <div key={c.id} className="card-soft flex flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="t-strong text-stone-900">{c.name}</div>
                    <p className="t-fine mt-0.5 text-stone-500">{c.blurb}</p>
                  </div>
                  <span className={`t-fine inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${s.tone}`}>
                    <s.Icon className="h-3 w-3" />
                    {s.label}
                  </span>
                </div>

                {c.account && (
                  <div className="t-fine mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-500">
                    <span className="rounded bg-stone-50 px-1.5 py-0.5 font-mono text-[11px] text-stone-600">{c.account}</span>
                    {c.lastSync && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> synced {c.lastSync}
                      </span>
                    )}
                  </div>
                )}

                {c.issue && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50/80 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p className="t-fine text-amber-900">{c.issue}</p>
                  </div>
                )}

                {c.scopes.length > 0 && (
                  <div className="mt-3">
                    <div className="t-fine mb-1 text-stone-400">
                      {c.state === 'available' ? 'We would ask for' : 'You granted'}
                    </div>
                    <ul className="space-y-0.5">
                      {c.scopes.map(sc => (
                        <li key={sc} className="t-fine flex items-center gap-1.5 text-stone-600">
                          <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-stone-300" />
                          {sc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.pendingReview && (
                  <p className="t-fine mt-3 text-stone-400">
                    Our access to this platform is still in review. You can link it now and it will start reporting the
                    day we are approved.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <SectionHeading
          title="What we can actually prove"
          hint="Three grades of truth, and the console labels every number with the one it came from."
        />
        <div className="card-soft divide-y divide-stone-100">
          {ATTRIBUTION_GRADES.map(g => (
            <div key={g.grade} className="flex gap-3 p-4">
              <span
                className={
                  't-fine mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 font-bold ' +
                  (g.on ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500')
                }
              >
                {g.grade}
              </span>
              <div>
                <div className="t-strong text-stone-900">{g.label}</div>
                <p className="t-meta mt-0.5 text-stone-500">{g.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="t-fine mt-3 max-w-2xl text-stone-400">
          No tracking pixel is installed anywhere by this product. Attribution on WhatsLocal surfaces is a click id we
          write and read back in our own database; nothing is shared with an advertising platform unless you turn on
          conversion upload, which is off.
        </p>
      </section>
    </div>
  )
}
