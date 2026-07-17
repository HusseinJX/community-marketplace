import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

export interface SellStep {
  label: string
  desc: string
  href: string
  done: boolean
  /** Optional steps don't hold up "you can sell" and never block the next step. */
  optional?: boolean
}

// The path to a first sale, in order, with the next thing to do spelled out.
// Without this the vendor lands on a dashboard of tools and has to guess that
// selling means: link → connect a shop → add a bank → (optionally) delivery.
//
// Self-hides once every required step is done — a checklist of ticks is noise.
export function SellChecklist({ steps }: { steps: SellStep[] }) {
  const required = steps.filter((s) => !s.optional)
  if (required.every((s) => s.done)) return null

  // The first unfinished step is the one we push; the rest stay visible but quiet,
  // so the vendor can see the whole path without being shouted at four times.
  const nextIndex = steps.findIndex((s) => !s.done)

  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b border-stone-100 p-4">
        <p className="text-[15px] font-semibold text-stone-900">Start selling</p>
        <p className="mt-0.5 text-[13px] text-stone-500">
          {required.filter((s) => s.done).length} of {required.length} done — about 10 minutes total.
        </p>
      </div>
      <ol>
        {steps.map((step, i) => {
          const isNext = i === nextIndex
          return (
            <li key={step.href} className="border-b border-stone-100 last:border-0">
              <Link
                href={step.href}
                className="flex items-center gap-3 p-4 transition hover:bg-stone-50"
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className={'h-5 w-5 shrink-0 ' + (isNext ? 'text-indigo-500' : 'text-stone-300')} />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      'block text-sm font-semibold ' +
                      (step.done ? 'text-stone-400 line-through' : 'text-stone-900')
                    }
                  >
                    {step.label}
                    {step.optional && !step.done && (
                      <span className="ml-1.5 text-[11px] font-medium text-stone-400">Optional</span>
                    )}
                  </span>
                  {!step.done && <span className="block text-xs text-stone-500">{step.desc}</span>}
                </span>
                {isNext && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                    {step.done ? 'Review' : 'Start'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
