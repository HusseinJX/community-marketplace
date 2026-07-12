import { COMMUNITY_RESOURCES } from '@/lib/community-resources'
import { ResourceGrid } from '@/components/resources/ResourceGrid'
import { ResourceChat } from '@/components/resources/ResourceChat'

export const metadata = {
  title: 'Local resources',
  description:
    'Free and low-cost help for San Francisco residents — food, housing, healthcare, legal aid, financial help, family, jobs, and community organizations.',
}

const STARTERS = [
  'I need help with food',
  'Help paying rent',
  'Free or low-cost healthcare',
]

// Resident-facing community resource explorer — a separate page from the
// vendor small-business hub (/vendor/resources). Same look, different content
// and a different (public) AI guide.
export default function CommunityResourcesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 md:px-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Local resources</h1>
        <p className="mt-1 text-sm text-stone-500">
          Free and low-cost help near you — food, housing, healthcare, legal aid, financial help,
          family, jobs, immigration, and community organizations. Browse, search, or ask the guide
          what fits your situation.
        </p>
      </div>

      <section>
        <p className="section-label mb-4">All resources</p>
        <ResourceGrid resources={COMMUNITY_RESOURCES} />
      </section>

      {/* Floating guide — its own public endpoint + community catalog. */}
      <ResourceChat
        businessName="you"
        title="Community guide"
        subtitle="Find help near you"
        endpoint="/api/resources/chat"
        starters={STARTERS}
        catalog="community"
      />
    </div>
  )
}
