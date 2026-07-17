const UBER_BASE = 'https://api.uber.com/v1'
const UBER_AUTH_URL = 'https://auth.uber.com/oauth/v2/token'

// Uber Direct has no long-lived "server token" to paste into an env var. Auth is
// OAuth client-credentials: exchange client id + secret for a Bearer token that
// expires in 30 days, cache it, re-mint on expiry.
// https://developer.uber.com/docs/deliveries/guides/authentication
//
// This module previously sent `Bearer ${UBER_DIRECT_SERVER_TOKEN}` — a credential
// Uber doesn't issue for this API — so dispatch could never have worked, with or
// without env vars set.
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const res = await fetch(UBER_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.UBER_DIRECT_CLIENT_ID!,
      client_secret: process.env.UBER_DIRECT_CLIENT_SECRET!,
      grant_type: 'client_credentials',
      scope: 'eats.deliveries',
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Uber Direct auth failed: ${res.status} ${err}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  // 60s safety margin so a token can't expire mid-flight.
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

async function headers() {
  return {
    Authorization: `Bearer ${await accessToken()}`,
    'Content-Type': 'application/json',
  }
}

function customerId() {
  return process.env.UBER_DIRECT_CUSTOMER_ID!
}

// Whether the platform has Uber credentials at all. Without this, customerId()
// interpolates `undefined` into the request URL and every call fails with an
// opaque Uber error — so the vendor-facing delivery toggle checks this first
// rather than promising a delivery we can't dispatch.
export function uberConfigured(): boolean {
  return !!(
    process.env.UBER_DIRECT_CUSTOMER_ID &&
    process.env.UBER_DIRECT_CLIENT_ID &&
    process.env.UBER_DIRECT_CLIENT_SECRET
  )
}

export interface DeliveryAddress {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
}

export interface DeliveryQuote {
  quote_id: string
  fee_cents: number
  pickup_eta_minutes: number
  dropoff_eta_minutes: number
  currency: string
}

export async function quoteDelivery(
  pickupAddress: string,
  dropoff: DeliveryAddress
): Promise<DeliveryQuote> {
  const res = await fetch(`${UBER_BASE}/customers/${customerId()}/delivery_quotes`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      pickup_address: pickupAddress,
      dropoff_address: `${dropoff.street}, ${dropoff.city}, ${dropoff.state} ${dropoff.zip}`,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? `Uber quote failed: ${res.status}`)
  }

  const data = await res.json()
  return {
    quote_id: data.id,
    fee_cents: Math.round((data.fee ?? 0) * 100),
    pickup_eta_minutes: data.duration ?? 0,
    dropoff_eta_minutes: (data.duration ?? 0) + (data.dropoff_eta ?? 0),
    currency: data.currency ?? 'usd',
  }
}

export interface ManifestItem {
  name: string
  quantity: number
  size: 'small' | 'medium' | 'large'
  price: number
}

export interface DispatchResult {
  delivery_id: string
  tracking_url: string
  status: string
}

export async function dispatchDelivery(opts: {
  orderId: string
  orderNumber: string
  quoteId: string
  pickupName: string
  pickupAddress: string
  pickupPhone: string
  dropoff: DeliveryAddress
  items: ManifestItem[]
}): Promise<DispatchResult> {
  const res = await fetch(`${UBER_BASE}/customers/${customerId()}/deliveries`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      quote_id: opts.quoteId,
      pickup: {
        name: opts.pickupName,
        address: opts.pickupAddress,
        phone_number: opts.pickupPhone,
      },
      dropoff: {
        name: opts.dropoff.name,
        address: `${opts.dropoff.street}, ${opts.dropoff.city}, ${opts.dropoff.state} ${opts.dropoff.zip}`,
        phone_number: opts.dropoff.phone,
      },
      manifest_items: opts.items,
      external_id: opts.orderId,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? `Uber dispatch failed: ${res.status}`)
  }

  const data = await res.json()
  return {
    delivery_id: data.id,
    tracking_url: data.tracking_url,
    status: data.status,
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.UBER_DIRECT_WEBHOOK_SECRET
  if (!secret) return false
  const crypto = require('crypto')
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
