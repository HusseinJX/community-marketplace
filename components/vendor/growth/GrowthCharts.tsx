'use client'

import { useMemo, useRef, useState } from 'react'

/**
 * Chart primitives for the Growth console.
 *
 * Hand-rolled SVG rather than a charting library: the repo carries no charting
 * dependency, these are three shapes, and a 40KB import for a demo is the kind
 * of thing that quietly survives into production.
 *
 * All of them are viewBox-scaled and sized by their container, so they stay
 * sharp at any width and need no resize observer.
 */

const REV = '#4f46e5' // indigo-600 — the money that came back
const SPEND = '#a8a29e' // stone-400 — the money that went out

/** Catmull-Rom → cubic Bézier. A local-bakery chart shouldn't look like a seismograph. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/** A bare trend line, no axes — for table rows. */
export function Sparkline({
  values,
  color = REV,
  className = '',
}: {
  values: number[]
  color?: string
  className?: string
}) {
  const d = useMemo(() => {
    if (values.length < 2) return ''
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const span = max - min || 1
    const pts = values.map(
      (v, i) => [(i / (values.length - 1)) * 100, 24 - ((v - min) / span) * 22] as [number, number]
    )
    return smoothPath(pts)
  }, [values])

  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export interface TrendPoint {
  date: string
  spend: number
  revenue: number
}

/**
 * Spend against revenue over the window, with a crosshair readout.
 *
 * The two series share one scale on purpose — the whole question a vendor is
 * asking is "is the top line above the bottom one", and separate axes would let
 * a losing account look balanced.
 */
export function SpendRevenueChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)

  const W = 720
  const H = 200
  const PAD_T = 14
  const PAD_B = 22

  const { revPath, spendPath, revArea, max, xs } = useMemo(() => {
    const max = Math.max(1, ...points.map(p => Math.max(p.spend, p.revenue))) * 1.12
    const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W / 2)
    const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B)
    const revPts = points.map((p, i) => [x(i), y(p.revenue)] as [number, number])
    const spendPts = points.map((p, i) => [x(i), y(p.spend)] as [number, number])
    const rp = smoothPath(revPts)
    return {
      max,
      xs: points.map((_, i) => x(i)),
      revPath: rp,
      spendPath: smoothPath(spendPts),
      revArea: rp ? `${rp} L ${W} ${H - PAD_B} L 0 ${H - PAD_B} Z` : '',
    }
  }, [points])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || points.length === 0) return
    const rel = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - rel) < Math.abs(xs[best] - rel)) best = i
    setHover(best)
  }

  const active = hover != null ? points[hover] : points[points.length - 1]
  const activeIdx = hover != null ? hover : points.length - 1

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <Legend color={REV} label="Attributed revenue" value={active ? `$${Math.round(active.revenue)}` : '—'} />
        <Legend color={SPEND} label="Ad spend" value={active ? `$${Math.round(active.spend)}` : '—'} />
        <span className="t-fine text-stone-400">
          {active ? formatDay(active.date) : ''}
          {hover == null && points.length > 0 ? ' · latest' : ''}
        </span>
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        style={{ height: 200 }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Ad spend and attributed revenue over the selected period"
      >
        <defs>
          <linearGradient id="revFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={REV} stopOpacity={0.16} />
            <stop offset="100%" stopColor={REV} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Three gridlines. More would be a spreadsheet. */}
        {[0.25, 0.5, 0.75].map(f => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={PAD_T + f * (H - PAD_T - PAD_B)}
            y2={PAD_T + f * (H - PAD_T - PAD_B)}
            stroke="#e7e5e4"
            strokeWidth={1}
          />
        ))}
        <line x1={0} x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="#d6d3d1" strokeWidth={1} />

        <path d={revArea} fill="url(#revFill)" />
        <path d={spendPath} fill="none" stroke={SPEND} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
        <path d={revPath} fill="none" stroke={REV} strokeWidth={2.4} strokeLinecap="round" />

        {activeIdx >= 0 && points.length > 0 && (
          <g>
            <line x1={xs[activeIdx]} x2={xs[activeIdx]} y1={PAD_T} y2={H - PAD_B} stroke="#a8a29e" strokeWidth={1} />
            <circle cx={xs[activeIdx]} cy={yOf(points[activeIdx].revenue, max, H, PAD_T, PAD_B)} r={4} fill="#fff" stroke={REV} strokeWidth={2.4} />
            <circle cx={xs[activeIdx]} cy={yOf(points[activeIdx].spend, max, H, PAD_T, PAD_B)} r={3.5} fill="#fff" stroke={SPEND} strokeWidth={2} />
          </g>
        )}

        {points.length > 1 && (
          <>
            <text x={2} y={H - 6} className="fill-stone-400" style={{ fontSize: 11 }}>
              {formatDay(points[0].date)}
            </text>
            <text x={W - 2} y={H - 6} textAnchor="end" className="fill-stone-400" style={{ fontSize: 11 }}>
              {formatDay(points[points.length - 1].date)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

function yOf(v: number, max: number, H: number, padT: number, padB: number) {
  return padT + (1 - v / max) * (H - padT - padB)
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="t-fine text-stone-500">{label}</span>
      <span className="t-strong tabular-nums text-stone-900">{value}</span>
    </span>
  )
}

export function formatDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Weekly bars — used for organic clicks, where daily is noise. */
export function WeeklyBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-stretch gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
          {/* The bar lives in its own fixed-height track. A percentage height
              only resolves against a parent with a definite height, and the
              label has to sit OUTSIDE that track or a full-height bar pushes
              it off the bottom of the card. */}
          <div className="flex h-24 w-full items-end">
            <div
              className="w-full rounded-t-[3px] bg-indigo-200 transition group-hover:bg-indigo-500"
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              title={`${labels[i]}: ${v}`}
            />
          </div>
          <span className="t-fine truncate text-stone-400">{i % 2 === 0 ? labels[i] : ''}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * A position bar for a search query. Inverted on purpose — position 1 fills the
 * bar, position 20 barely registers — because "bigger is better" is the only
 * reading anyone gives a bar chart, and raw rank is the opposite.
 */
export function PositionBar({ position }: { position: number }) {
  const fill = Math.max(0.04, Math.min(1, (21 - position) / 20))
  const tone = position <= 3 ? 'bg-emerald-500' : position <= 10 ? 'bg-amber-400' : 'bg-stone-300'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${fill * 100}%` }} />
    </div>
  )
}
