import 'server-only'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  SignedDataVerifier,
  Environment,
  NotificationTypeV2,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'
import type { Plan } from '@/lib/entitlements'
import { planFromProductId } from '@/lib/iap-products'

// Apple In-App Purchase server verification. StoreKit purchases in the iOS app
// arrive as Apple-signed JWS blobs (a signed transaction from the client, and
// App Store Server Notifications V2 from Apple). We verify the signature +
// certificate chain against Apple's root CAs using Apple's official library,
// then write the resulting plan into the SAME `subscriptions` table the Stripe
// path uses — so entitlements have one source of truth (see lib/subscriptions.ts).
//
// Binding: the first purchase goes through /api/iap/verify while the user is
// signed in, so we record member_id ↔ apple_original_transaction_id. Later
// lifecycle events (renew/expire/refund) come via /api/apple/notifications with
// only the originalTransactionId, and we resolve the member from that binding —
// mirroring how Stripe binds customer_id ↔ member at checkout.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
)

const BUNDLE_ID = process.env.APPLE_IAP_BUNDLE_ID || 'ai.whatslocal.app'
const APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID
  ? Number(process.env.APPLE_APP_APPLE_ID)
  : undefined

// Apple's root CAs (public certs) — download the 4 from
// https://www.apple.com/certificateauthority/ into this dir (committed; they're
// public). AppleRootCA-G3 is the one that signs IAP data. Fail closed if absent.
const ROOT_DIR = process.env.APPLE_ROOT_CAS_DIR || join(process.cwd(), 'certs/apple')

let cachedRoots: Buffer[] | null = null
function rootCerts(): Buffer[] {
  if (cachedRoots) return cachedRoots
  try {
    const files = readdirSync(ROOT_DIR).filter((f) => /\.(cer|der|pem|crt)$/i.test(f))
    cachedRoots = files.map((f) => readFileSync(join(ROOT_DIR, f)))
  } catch {
    cachedRoots = []
  }
  return cachedRoots
}

/** True when Apple root CAs are present so verification can run. */
export function appleIapConfigured(): boolean {
  return rootCerts().length > 0
}

// One verifier per environment (sandbox during App Review + testing, production
// once live). Both use the same root certs; we try both so a payload from either
// environment verifies without redeploying. Cached after first build.
const verifiers = new Map<Environment, SignedDataVerifier>()
function verifierFor(env: Environment): SignedDataVerifier {
  let v = verifiers.get(env)
  if (!v) {
    v = new SignedDataVerifier(rootCerts(), true, env, BUNDLE_ID, APP_APPLE_ID)
    verifiers.set(env, v)
  }
  return v
}

// Try production first, then sandbox (verification throws on env mismatch).
async function eitherEnv<T>(fn: (v: SignedDataVerifier) => Promise<T>): Promise<T> {
  if (!appleIapConfigured()) throw new Error('apple_iap_not_configured')
  try {
    return await fn(verifierFor(Environment.PRODUCTION))
  } catch {
    return await fn(verifierFor(Environment.SANDBOX))
  }
}

export function verifyTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  return eitherEnv((v) => v.verifyAndDecodeTransaction(jws))
}

export function verifyNotification(jws: string): Promise<ResponseBodyV2DecodedPayload> {
  return eitherEnv((v) => v.verifyAndDecodeNotification(jws))
}

// ── Plan + persistence ─────────────────────────────────────────────────────────

/** Active if it hasn't expired and wasn't revoked/refunded. */
function isActive(txn: JWSTransactionDecodedPayload): boolean {
  if (txn.revocationDate) return false
  return typeof txn.expiresDate === 'number' && txn.expiresDate > Date.now()
}

function planForTransaction(txn: JWSTransactionDecodedPayload): Plan {
  return isActive(txn) ? planFromProductId(txn.productId) : 'free'
}

interface UpsertArgs {
  memberId: string
  txn: JWSTransactionDecodedPayload
  status: string
}

async function upsertAppleSubscription({ memberId, txn, status }: UpsertArgs) {
  const plan = planForTransaction(txn)
  await supabase.from('subscriptions').upsert(
    {
      member_id: memberId,
      plan,
      status,
      source: 'apple',
      apple_product_id: txn.productId ?? null,
      apple_original_transaction_id: txn.originalTransactionId ?? null,
      current_period_end: txn.expiresDate ? new Date(txn.expiresDate).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id' },
  )

  // Pro/enterprise unlock the premium AI-image quota; downgrades revoke it
  // (mirrors syncFromStripeSubscription).
  const premium = plan === 'pro' || plan === 'enterprise'
  await supabase
    .from('ai_image_credits')
    .upsert({ member_id: memberId, premium, updated_at: new Date().toISOString() }, { onConflict: 'member_id' })

  return plan
}

/**
 * Fast path: a signed-in member just purchased in the app. Verify the signed
 * transaction and grant the plan, binding member_id ↔ originalTransactionId so
 * later notifications resolve back to this member. Returns the granted plan.
 */
export async function grantFromSignedTransaction(memberId: string, jws: string): Promise<Plan> {
  const txn = await verifyTransaction(jws)
  return upsertAppleSubscription({
    memberId,
    txn,
    status: isActive(txn) ? 'active' : 'canceled',
  })
}

async function memberIdForOriginalTxn(originalTransactionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('member_id')
    .eq('apple_original_transaction_id', originalTransactionId)
    .single()
  return (data as { member_id: string } | null)?.member_id ?? null
}

/**
 * Durable path: an App Store Server Notification V2. Verify it, pull the
 * transaction, resolve the member from the stored binding, and sync their plan.
 * No-ops (returns false) for TEST notifications or unbound transactions.
 */
export async function syncFromNotification(signedPayload: string): Promise<boolean> {
  const notification = await verifyNotification(signedPayload)
  if (notification.notificationType === NotificationTypeV2.TEST) return true

  const signedTxn = notification.data?.signedTransactionInfo
  if (!signedTxn) return false
  const txn = await verifyTransaction(signedTxn)
  if (!txn.originalTransactionId) return false

  const memberId = await memberIdForOriginalTxn(txn.originalTransactionId)
  if (!memberId) return false // never bound via the fast path — nothing to sync

  const type = notification.notificationType
  const downgraded =
    type === NotificationTypeV2.EXPIRED ||
    type === NotificationTypeV2.REFUND ||
    type === NotificationTypeV2.REVOKE ||
    type === NotificationTypeV2.GRACE_PERIOD_EXPIRED
  const status = downgraded ? 'canceled' : isActive(txn) ? 'active' : 'canceled'

  await upsertAppleSubscription({ memberId, txn, status })
  return true
}
