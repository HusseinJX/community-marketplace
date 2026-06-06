import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { getVendorProfile } from '@/lib/vendor-connect'
import { buildBusinessContext } from '@/lib/business-context'
import { memberProfileUrl } from '@/lib/qr'
import { BasicQr } from '@/components/qr/BasicQr'
import { AiQr } from '@/components/qr/AiQr'

// Tier 1 is opt-in. Unset/`0` = basic only — the safe, revertible default.
const AI_QR_ENABLED = process.env.NEXT_PUBLIC_QR_AI === '1'

export const metadata = {
  title: 'QR code',
}

export default async function VendorQrPage() {
  const { userId } = await auth()
  const profile = userId ? await getVendorProfile(userId) : null

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Your QR code</h1>
          <p className="mt-1 text-sm text-stone-500">A QR code that sends customers straight to your profile.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-900">Link your business first</p>
          <p className="mt-1 text-sm text-amber-700">
            Connect your profile and we&apos;ll generate a QR code that points to it.
          </p>
          <Link
            href="/vendor/setup"
            className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
          >
            Link profile
          </Link>
        </div>
      </div>
    )
  }

  const ctx = await buildBusinessContext(profile.member_id)
  const url = memberProfileUrl(profile.member_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Your QR code</h1>
        <p className="mt-1 text-sm text-stone-500">
          Print it on flyers, your window, or a table tent. Anyone who scans it lands on your
          marketplace profile.
        </p>
      </div>
      <BasicQr url={url} businessName={ctx.businessName} />
      {AI_QR_ENABLED && <AiQr businessName={ctx.businessName} />}
    </div>
  )
}
