import { stripe } from '@/lib/stripe-server'
import { getVendorConnectAccount, updateVendorConnectStatus } from '@/lib/vendor-connect'

// Whether a member can actually take money right now.
//
// `stripe_connect_accounts.status` is a CACHE. It is written 'pending' when the
// account is created and flipped to 'active' by exactly one thing: the
// `account.updated` case in the Stripe webhook. So a vendor who finishes Stripe's
// hosted onboarding while that webhook is unregistered, misdelivered, or replaying
// late stays 'pending' in our table forever — and every buyer gets
// STRIPE_CONNECT_NOT_SETUP while the vendor's Integrations page (which reads
// Stripe live) shows a green "Ready" badge. Neither side can see the other's view,
// so nobody can diagnose it.
//
// This is commerce invariant #1: the server derives, it never trusts a value it
// can look up. Stripe is the authority on whether charges are enabled, and it's
// one call away. The webhook stays useful as an optimisation — it keeps the cached
// row warm so the common path costs nothing — but it is no longer load-bearing.
//
// Only the NEGATIVE case re-checks. A cached 'active' is returned as-is: Stripe
// revoking a capability is rare and the webhook handles it, and paying for a live
// retrieve on every checkout of every healthy vendor would be a tax on the path
// that works.

export interface ConnectPayoutState {
  /** The Connect account id, or null when the member never started onboarding. */
  accountId: string | null
  /** True only when Stripe will accept a charge on this account today. */
  active: boolean
}

export async function getConnectPayoutState(memberId: string): Promise<ConnectPayoutState> {
  const row = await getVendorConnectAccount(memberId)
  if (!row?.stripe_account_id) return { accountId: null, active: false }

  const accountId = row.stripe_account_id
  if (row.status === 'active') return { accountId, active: true }

  // Cached as not-ready — ask Stripe before turning a buyer away.
  try {
    const account = await stripe.accounts.retrieve(accountId)
    const active = Boolean(account.details_submitted && account.charges_enabled)
    if (active) {
      // Heal the row so the next call takes the cheap path, and so the vendor's
      // own "payouts ready" surfaces agree. A write failure must not fail the
      // sale — we already know the true answer.
      await updateVendorConnectStatus(accountId, 'active').catch(() => {})
    }
    return { accountId, active }
  } catch {
    // Stripe unreachable: fall back to the cache, which says not ready. Blocking
    // is the safe direction — a PaymentIntent against a disabled account fails
    // anyway, just later and with a worse error.
    return { accountId, active: false }
  }
}
