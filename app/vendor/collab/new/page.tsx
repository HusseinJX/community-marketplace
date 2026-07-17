import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { isAdmin } from '@/lib/admin'
import { demoMemberId, isDemoActive } from '@/lib/demo-server'
import { getEntitlements } from '@/lib/entitlements'
import { NewCollabForm } from './NewCollabForm'

// The New collaboration PAGE — what "New collaboration" in Messages → Collabs
// opens. Same composer as the dashboard's Create card (shared CollabComposer):
// name + description + the For-you/Search people picker.
export default async function NewCollabPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>
}) {
  const { userId } = await auth()
  const { memberId: requested } = await searchParams
  const profile = userId ? await getVendorProfile(userId) : null
  const admin = isAdmin(userId)
  let memberId = admin && requested ? requested : profile?.member_id
  const adminDemo = !userId && (await isDemoActive())
  if (!memberId && adminDemo) memberId = await demoMemberId()

  if (!memberId) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold text-stone-900">New collaboration</h1>
        <div className="card-soft p-4">
          <p className="text-sm font-medium text-stone-900">Link your business to collaborate</p>
          <p className="mt-1 text-[13px] text-stone-600">
            You need a linked profile before you can start a collaboration.
          </p>
          <Link
            href="/vendor/setup"
            className="mt-3 inline-flex rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800"
          >
            Link your business
          </Link>
        </div>
      </div>
    )
  }

  const { can } = await getEntitlements(memberId)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/vendor/messages?tab=collabs"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Collaborations
      </Link>

      <h1 className="text-xl font-semibold text-stone-900">New collaboration</h1>

      <NewCollabForm
        memberId={memberId}
        isAdmin={admin}
        demo={adminDemo}
        canInvite={can.networkInitiate}
        existingCount={0}
      />
    </div>
  )
}
