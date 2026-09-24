import type { Metadata } from 'next'
import { GrowthConsole } from '@/components/vendor/growth/GrowthConsole'

/**
 * `/vendor/growth` — the Growth console demo.
 *
 * DELIBERATELY UNLINKED FROM THE VENDOR NAV. The only link to it is in
 * super-admin (`/vendor/admin` → Create profile → Demos); otherwise it is
 * reached by typing the path. It still sits inside `app/vendor/`, so the portal's Clerk
 * gate applies and a signed-out visitor is redirected to /vendor/sign-in — which
 * is the point: a realistic-looking dashboard full of invented numbers must not
 * be findable by a real vendor or indexable by anyone.
 *
 * See `docs/context/growth-console.md` for what it is for and what the real
 * version would need.
 */
export const metadata: Metadata = {
  title: 'Growth (demo)',
  robots: { index: false, follow: false },
}

export default function VendorGrowthPage() {
  return <GrowthConsole />
}
