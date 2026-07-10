import { auth } from '@clerk/nextjs/server'
import { Sparkles } from 'lucide-react'
import { getVendorProfile } from '@/lib/vendor-connect'
import { buildBusinessContext } from '@/lib/business-context'
import { recommendResources, RESOURCES } from '@/lib/resources'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { ResourceGrid } from '@/components/resources/ResourceGrid'
import { ResourceChat } from '@/components/resources/ResourceChat'

export const metadata = {
  title: 'Resources',
}

export default async function ResourcesPage() {
  const { userId } = await auth()
  const profile = userId ? await getVendorProfile(userId) : null

  // Recommendations need the linked business profile. Without one we still show
  // the full, searchable catalog — it's valuable on its own.
  let businessName = 'your business'
  let recommendations: Awaited<ReturnType<typeof recommendResources>> = []
  if (profile) {
    const ctx = await buildBusinessContext(profile.member_id)
    businessName = ctx.businessName
    // No explicit category passed: recommendResources scans the knowledge blob
    // (which already contains "Category: …") for category + keyword evidence.
    recommendations = recommendResources(ctx, { limit: 4 })
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Small business resources</h1>
        <p className="mt-1 text-sm text-stone-500">
          Local help in one place — legal, accounting, energy savings, going green, accessibility,
          permits, funding, and more. Browse, search, or ask the guide what fits you.
        </p>
      </div>

      {recommendations.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="section-label">Recommended for {businessName}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.map((rec) => (
              <ResourceCard key={rec.resource.id} resource={rec.resource} reasons={rec.reasons} />
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="section-label mb-4">All resources</p>
        <ResourceGrid resources={RESOURCES} />
      </section>

      {/* Floating guide — sticky circle button bottom-right that expands the chat. */}
      <ResourceChat businessName={businessName} />
    </div>
  )
}
