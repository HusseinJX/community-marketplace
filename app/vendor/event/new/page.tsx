import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { isAdmin } from '@/lib/admin'
import { demoMemberId, isDemoActive } from '@/lib/demo-server'
import { getMember } from '@/lib/api'
import { NewEventForm } from './NewEventForm'

// The New event PAGE — the event twin of /vendor/collab/new. Same shape: name
// it, describe it, pick who's in, create. Reached from "Create new event" in
// Organize.
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>
}) {
  const { userId } = await auth()
  const { memberId: requested } = await searchParams
  const profile = userId ? await getVendorProfile(userId) : null
  const admin = isAdmin(userId)
  let memberId = admin && requested ? requested : profile?.member_id
  const demo = !userId && (await isDemoActive())
  if (!memberId && demo) memberId = await demoMemberId()

  if (!memberId) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold text-stone-900">New event</h1>
        <div className="card-soft p-4">
          <p className="text-sm font-medium text-stone-900">Link your business to host events</p>
          <p className="mt-1 text-[13px] text-stone-600">
            You need a linked profile before you can create an event.
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

  let memberName = 'Vendor'
  try {
    const v = await getMember(memberId)
    memberName =
      (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || memberName
  } catch {
    /* non-fatal — the name is only denormalized onto the event */
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/vendor/organize"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Events
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-stone-900">New event</h1>
        <p className="mt-1 text-sm text-stone-500">Name it, say when and where, and line up your people.</p>
      </div>

      <NewEventForm memberId={memberId} memberName={memberName} isAdmin={admin} demo={demo} />
    </div>
  )
}
