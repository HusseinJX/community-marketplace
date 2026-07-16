import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { isAdmin } from '@/lib/admin'
import { demoMemberId, isDemoActive } from '@/lib/demo-server'
import { getEntitlements } from '@/lib/entitlements'
import { MessagesShell } from './MessagesShell'
import { CustomerInbox } from './CustomerInbox'

// The single inbox: Collaborations + Customers. (These were two separate nav
// tabs — /vendor/network now redirects here.) Server-resolves the acting member
// the way the old network page did, since the collab surface needs a member_id
// and a plan to gate on.
export default async function VendorMessagesPage({
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

  // No linked profile → no collaborations to show, but customer messages don't
  // need one. Show the inbox and point them at setup.
  if (!memberId) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold text-stone-900">Messages</h1>
        <div className="card-soft p-4">
          <p className="text-sm font-medium text-stone-900">Link your business to collaborate</p>
          <p className="mt-1 text-[13px] text-stone-600">
            Collaborations show up here once your profile is linked.
          </p>
          <Link
            href="/vendor/setup"
            className="mt-3 inline-flex rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800"
          >
            Link your business
          </Link>
        </div>
        <CustomerInbox />
      </div>
    )
  }

  const { plan } = await getEntitlements(memberId)

  return <MessagesShell memberId={memberId} isAdmin={admin} plan={plan} adminDemo={adminDemo} />
}
