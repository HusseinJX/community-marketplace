import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { buildBusinessContext } from '@/lib/business-context'
import { recommendResources, RESOURCES } from '@/lib/resources'
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

  // Recommended resources are surfaced as the top-ranked cards inside the single
  // "All resources" list (with their reason badges) rather than in a separate
  // section above — so there's one list, best matches first.
  const recommended = recommendations.map((rec) => ({
    id: rec.resource.id,
    reasons: rec.reasons,
  }))

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Small business resources</h1>
        <p className="mt-1 text-sm text-stone-500">
          Local help in one place — legal, accounting, energy savings, going green, accessibility,
          permits, funding, and more. Browse, search, or ask the guide what fits you.
        </p>
      </div>

      <section>
        <p className="section-label mb-4">All resources</p>
        <ResourceGrid resources={RESOURCES} recommended={recommended} />
      </section>

      {/* Floating guide — sticky circle button bottom-right that expands the chat. */}
      <ResourceChat businessName={businessName} />
    </div>
  )
}
