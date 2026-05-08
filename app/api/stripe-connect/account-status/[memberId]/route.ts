import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { getVendorConnectAccount } from '@/lib/vendor-connect'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params
    const vendorAccount = await getVendorConnectAccount(memberId)

    if (!vendorAccount) {
      return NextResponse.json({ hasAccount: false, status: 'not_setup' })
    }

    const account = await stripe.accounts.retrieve(vendorAccount.stripe_account_id)

    const status =
      account.details_submitted && account.charges_enabled ? 'active' : 'pending'

    return NextResponse.json({
      hasAccount: true,
      accountId: vendorAccount.stripe_account_id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      status,
    })
  } catch (error: unknown) {
    console.error('account-status error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch account status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
