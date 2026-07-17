import { redirect } from 'next/navigation'

// Payouts were merged into the one Integrations hub (shop + delivery + bank).
// This route stays as a redirect so any old link, bookmark, or Stripe return URL
// still lands somewhere real.
export default function VendorPaymentsPage() {
  redirect('/vendor/integrations')
}
