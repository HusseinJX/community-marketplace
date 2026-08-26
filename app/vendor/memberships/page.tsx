import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { getConnectPayoutState } from '@/lib/connect-status'
import { MembershipsManager } from './MembershipsManager'

export const metadata = {
  title: 'Memberships',
}

// The vendor's own subscription product — what their regulars pay them monthly.
// Nothing to do with /vendor/billing, which is what they pay US. Two different
// subscriptions in one portal, so both screens say whose money it is.
export default async function VendorMembershipsPage() {
  const { userId } = await auth()
  const profile = userId ? await getVendorProfile(userId) : null
  // Selling anything needs a payout account, and a membership is a sale that
  // repeats — better to say so before they design a tier nobody can buy.
  const payouts = profile ? await getConnectPayoutState(profile.member_id) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Memberships</h1>
        <p className="mt-1 text-sm text-stone-500">
          A monthly charge your regulars pay for perks you decide. It shows up on your profile, and
          the money lands where your sales do — we keep 5%, the same as a sale.
        </p>
      </div>

      {payouts && !payouts.active && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Connect your bank first</p>
          <p className="mt-1 text-sm text-amber-800">
            You can write your tiers now, but nobody can join until payouts are switched on.
          </p>
          <Link
            href="/vendor/payments"
            className="mt-3 inline-flex items-center justify-center rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Set up payouts
          </Link>
        </div>
      )}

      <MembershipsManager />
    </div>
  )
}
