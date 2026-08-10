import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { SITE_URL } from './seo'

// Digital goods: storing the file, and granting one buyer access to it.
//
// The shape deliberately mirrors ticketing — a random token in an emailed link,
// because a guest buyer has no account to authenticate against. The difference
// is the file itself: it lives in a PRIVATE bucket and is only ever handed over
// as a short-lived signed URL, so the thing in the buyer's inbox is a claim on
// the file rather than the file's address.

export const DIGITAL_BUCKET = 'digital-goods'

// How long a minted download URL stays valid. Long enough to survive a slow
// connection and a click from an email client's proxy, short enough that a
// forwarded URL is dead on arrival — the durable thing is the grant, which can
// be re-redeemed.
const SIGNED_URL_TTL_SECONDS = 300

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    // Service-role matters here, not just for RLS: signing a URL for a private
    // object is not something the anon key can do.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

/** True when digital delivery can actually work — service-role is required to sign URLs. */
export function digitalConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export interface DigitalGrant {
  id: string
  token: string
  order_id: string | null
  payment_intent_id: string | null
  member_id: string
  product_id: string | null
  product_name: string
  file_path: string
  file_name: string | null
  buyer_email: string | null
  attendee_id: string | null
  download_count: number
  max_downloads: number | null
  expires_at: string | null
  last_downloaded_at: string | null
  created_at: string
}

function newToken(): string {
  return randomBytes(16).toString('base64url')
}

export function downloadUrl(token: string): string {
  return `${SITE_URL}/download/${token}`
}

// ── Storing the file ─────────────────────────────────────────────────────────

/** Upload a digital product's file into the private bucket. Returns its object path. */
export async function uploadDigitalFile(
  buffer: Buffer | Uint8Array,
  opts: { memberId: string; filename: string; contentType?: string }
): Promise<{ path: string }> {
  // Randomise the stored name. The object path never reaches a browser, but a
  // guessable one would make a misconfigured bucket instantly exploitable
  // instead of merely wrong.
  const safe = opts.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${opts.memberId}/${randomBytes(8).toString('hex')}-${safe}`
  const { error } = await db()
    .storage.from(DIGITAL_BUCKET)
    .upload(path, buffer, { contentType: opts.contentType || 'application/octet-stream', upsert: false })
  if (error) throw new Error(`Digital upload failed: ${error.message}`)
  return { path }
}

export async function deleteDigitalFile(path: string): Promise<void> {
  await db().storage.from(DIGITAL_BUCKET).remove([path])
}

// ── Granting access ──────────────────────────────────────────────────────────

export interface GrantSpec {
  memberId: string
  productId: string | null
  productName: string
  filePath: string
  fileName: string | null
  buyerEmail: string | null
  attendeeId: string | null
  orderId?: string | null
  paymentIntentId?: string | null
  maxDownloads?: number | null
}

/**
 * Grant access to the digital lines of a purchase. Idempotent on the payment
 * intent, for the same reason ticket issuance is: the browser's confirm call
 * and the Stripe webhook both land here, and a second set of grants would mean
 * a second set of links in a second email.
 */
export async function grantDigitalAccess(specs: GrantSpec[], paymentIntentId?: string | null): Promise<DigitalGrant[]> {
  if (specs.length === 0) return []
  if (paymentIntentId) {
    const existing = await getGrantsByPaymentIntent(paymentIntentId)
    if (existing.length > 0) return existing
  }

  const rows = specs.map((s) => ({
    token: newToken(),
    order_id: s.orderId ?? null,
    payment_intent_id: s.paymentIntentId ?? paymentIntentId ?? null,
    member_id: s.memberId,
    product_id: s.productId,
    product_name: s.productName,
    file_path: s.filePath,
    file_name: s.fileName,
    buyer_email: s.buyerEmail,
    attendee_id: s.attendeeId,
    max_downloads: s.maxDownloads ?? null,
  }))

  const { data, error } = await db().from('digital_grants').insert(rows).select()
  if (error || !data) throw new Error(`Failed to grant digital access: ${error?.message}`)
  return data as DigitalGrant[]
}

export async function getGrantByToken(token: string): Promise<DigitalGrant | null> {
  const { data } = await db().from('digital_grants').select('*').eq('token', token).maybeSingle()
  return (data as DigitalGrant) ?? null
}

export async function getGrantsByPaymentIntent(paymentIntentId: string): Promise<DigitalGrant[]> {
  const { data } = await db()
    .from('digital_grants')
    .select('*')
    .eq('payment_intent_id', paymentIntentId)
    .order('created_at', { ascending: true })
  return (data ?? []) as DigitalGrant[]
}

export async function getGrantsForAttendee(attendeeId: string): Promise<DigitalGrant[]> {
  const { data } = await db()
    .from('digital_grants')
    .select('*')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false })
  return (data ?? []) as DigitalGrant[]
}

// ── Redeeming ────────────────────────────────────────────────────────────────

export type RedeemResult =
  | { ok: true; url: string; grant: DigitalGrant }
  | { ok: false; reason: 'not_found' | 'expired' | 'exhausted' | 'missing_file'; message: string }

/**
 * Turn a grant token into a working download.
 *
 * Every redemption mints a NEW signed URL rather than storing one, so the link
 * in the email keeps working for as long as the grant allows while any URL that
 * escapes it stops working in minutes.
 */
export async function redeemGrant(token: string): Promise<RedeemResult> {
  const grant = await getGrantByToken(token)
  if (!grant) return { ok: false, reason: 'not_found', message: 'This download link isn\'t valid.' }

  if (grant.expires_at && Date.parse(grant.expires_at) < Date.now()) {
    return { ok: false, reason: 'expired', message: 'This download link has expired. Contact the seller and they can send a new one.' }
  }
  if (grant.max_downloads != null && grant.download_count >= grant.max_downloads) {
    return {
      ok: false,
      reason: 'exhausted',
      message: `This link has been used its maximum ${grant.max_downloads} times. Contact the seller for another.`,
    }
  }

  const { data, error } = await db()
    .storage.from(DIGITAL_BUCKET)
    .createSignedUrl(grant.file_path, SIGNED_URL_TTL_SECONDS, {
      // Hand back the vendor's original filename rather than the randomised
      // stored one — the buyer should get "recipes.pdf", not a hex blob.
      download: grant.file_name || true,
    })
  if (error || !data?.signedUrl) {
    console.error('signed url failed:', error)
    return { ok: false, reason: 'missing_file', message: 'That file is temporarily unavailable. Please try again shortly.' }
  }

  // Counted AFTER the URL is successfully minted: a failure to produce a link
  // must not burn one of the buyer's downloads.
  await db()
    .from('digital_grants')
    .update({ download_count: grant.download_count + 1, last_downloaded_at: new Date().toISOString() })
    .eq('id', grant.id)

  return { ok: true, url: data.signedUrl, grant }
}
