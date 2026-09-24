'use client'

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { CHANNELS, type ChannelId } from '@/lib/growth-demo'

/** One headline number with its comparison. The comparison is the point. */
export function Stat({
  label,
  value,
  sub,
  change,
  /** Set when a fall is good (cost per result, average position). */
  inverse = false,
}: {
  label: string
  value: string
  sub?: string
  change?: number | null
  inverse?: boolean
}) {
  const good = change == null ? null : inverse ? change < 0 : change > 0
  return (
    <div className="card-soft p-4">
      <div className="t-fine text-stone-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="t-title tabular-nums text-stone-900">{value}</span>
        {change != null && (
          <span
            className={
              'inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ' +
              (good ? 'text-emerald-600' : 'text-rose-600')
            }
          >
            {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(change * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <div className="t-fine mt-1 text-stone-400">{sub}</div>}
    </div>
  )
}

export function ChannelChip({ channel }: { channel: ChannelId }) {
  const c = CHANNELS[channel]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.tint}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.short}
    </span>
  )
}

/** The segmented control used across the console — same shape as WhatsOn. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-full bg-stone-100 p-1">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={
            'rounded-full px-3 py-1.5 text-[13px] font-semibold transition ' +
            (value === o.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="t-section text-stone-900">{title}</h2>
        {hint && <p className="t-meta mt-0.5 max-w-xl text-stone-500">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/** Return on ad spend, coloured by whether it is actually working. */
export function RoasBadge({ value }: { value: number }) {
  const tone =
    value >= 3 ? 'bg-emerald-50 text-emerald-700' : value >= 1.5 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[12px] font-bold tabular-nums ${tone}`}>
      {value.toFixed(1)}×
    </span>
  )
}
