const UBER_BASE = 'https://api.uber.com/v1'

function headers() {
  return {
    Authorization: `Bearer ${process.env.UBER_DIRECT_SERVER_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function customerId() {
  return process.env.UBER_DIRECT_CUSTOMER_ID!
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
    headers: headers(),
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
    headers: headers(),
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
