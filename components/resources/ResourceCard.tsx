import { ExternalLink, Search } from 'lucide-react'
import { CATEGORY_META, searchUrl, type Resource } from '@/lib/resources'

const COST_STYLE: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700',
  'low-cost': 'bg-amber-50 text-amber-700',
  varies: 'bg-stone-100 text-stone-600',
}

const COST_LABEL: Record<string, string> = {
  free: 'Free',
  'low-cost': 'Low cost',
  varies: 'Varies',
}

export function ResourceCard({
  resource,
  reasons,
  compact = false,
}: {
  resource: Resource
  /** "Recommended because…" chips, when shown in the recommended rail. */
  reasons?: string[]
  /** Tighter layout for inline use in the chat. */
  compact?: boolean
}) {
  const href = resource.url ?? searchUrl(resource)
  const verified = Boolean(resource.url)

  return (
    <div className={`card-soft card-hover flex flex-col ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
          {CATEGORY_META[resource.category].label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COST_STYLE[resource.cost]}`}>
          {COST_LABEL[resource.cost]}
        </span>
      </div>

      <h3 className={`mt-3 font-semibold leading-tight text-stone-900 ${compact ? 'text-sm' : 'text-base'}`}>
        {resource.title}
      </h3>
      <p className="mt-0.5 text-xs text-stone-500">{resource.org}</p>

      <p className={`mt-2 text-stone-600 ${compact ? 'text-xs' : 'text-sm'} ${compact ? 'line-clamp-3' : ''}`}>
        {compact ? resource.summary : resource.description}
      </p>

      {reasons && reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <span key={r} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
              {r}
            </span>
          ))}
        </div>
      )}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        {verified ? (
          <>
            Learn more <ExternalLink className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            Find this program <Search className="h-3.5 w-3.5" />
          </>
        )}
      </a>
    </div>
  )
}
