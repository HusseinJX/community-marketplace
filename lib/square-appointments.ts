import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Square Bookings API client.
//
// ⚠️ UNVERIFIED AGAINST THE LIVE API — no Square account has been connected.
// Shapes are read defensively so drift degrades to "no slots" rather than a
// crash, and `square_env` lets this be exercised against Square's sandbox
// before a real business is exposed to it. See scripts/square-smoke.mts.
//
// Square prices and schedules a service VARIATION (a 45-minute cut, a 90-minute
// colour), not a service — so a variation id is what availability search and
// booking creation both name.

const HOSTS = {
  production: 'https://connect.squareup.com',
  sandbox: 'https://connect.squareupsandbox.com',
} as const

// Square requires a version header; it pins the response shape, so it is set
// deliberately rather than floating with whatever they ship next.
const SQUARE_VERSION = '2024-10-17'

export type SquareEnv = keyof typeof HOSTS

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    // Service-role required: vendor_secrets denies anon by design.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Square Appointments needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

export function squareConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

// ── Credentials ──────────────────────────────────────────────────────────────

export interface SquareCreds {
  token: string
  locationId: string | null
  env: SquareEnv
}

export async function getSquareCreds(memberId: string): Promise<SquareCreds | null> {
  const { data } = await db()
    .from('vendor_secrets')
    .select('square_token, square_location_id, square_env')
    .eq('member_id', memberId)
    .maybeSingle()
  if (!data?.square_token) return null
  return {
    token: data.square_token,
    locationId: data.square_location_id ?? null,
    env: (data.square_env === 'sandbox' ? 'sandbox' : 'production') as SquareEnv,
  }
}

export async function saveSquareCreds(
  memberId: string,
  creds: { token?: string; locationId?: string | null; env?: SquareEnv }
): Promise<void> {
  const row: Record<string, unknown> = { member_id: memberId, updated_at: new Date().toISOString() }
  if (creds.token !== undefined) row.square_token = creds.token
  if (creds.locationId !== undefined) row.square_location_id = creds.locationId
  if (creds.env !== undefined) row.square_env = creds.env
  const { error } = await db().from('vendor_secrets').upsert(row, { onConflict: 'member_id' })
  if (error) throw new Error(`Failed to save Square credentials: ${error.message}`)
}

export async function disconnectSquare(memberId: string): Promise<void> {
  await db()
    .from('vendor_secrets')
    .update({ square_token: null, square_location_id: null, updated_at: new Date().toISOString() })
    .eq('member_id', memberId)
}

// ── Transport ────────────────────────────────────────────────────────────────

export class SquareError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Square's own machine-readable code, e.g. INSUFFICIENT_SCOPES. */
    readonly code: string | null = null
  ) {
    super(message)
  }
}

async function call<T>(
  creds: SquareCreds,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${HOSTS[creds.env]}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json',
      'Square-Version': SQUARE_VERSION,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  })

  const text = await res.text()
  const parsed = text ? safeJson(text) : {}

  if (!res.ok) {
    const err = (parsed?.errors as Record<string, string>[] | undefined)?.[0]
    const code = err?.code ?? null
    // Scope failures are THE predictable failure here: the existing Square
    // connection (via Composio, for catalog and orders) does not carry
    // APPOINTMENTS_*, so a vendor who "already connected Square" will land
    // exactly here. Name it so the UI can say something useful.
    const message = err?.detail ?? err?.code ?? `Square ${res.status}`
    throw new SquareError(message, res.status, code)
  }
  return parsed as T
}

function safeJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

// ── Locations ────────────────────────────────────────────────────────────────

export interface SquareLocation {
  id: string
  name: string
}

/** Lists locations. Doubles as the token check on connect. */
export async function listLocations(creds: SquareCreds): Promise<SquareLocation[]> {
  const raw = await call<{ locations?: unknown[] }>(creds, '/v2/locations')
  const rows = Array.isArray(raw?.locations) ? raw.locations : []
  return rows.map((l) => {
    const loc = l as Record<string, unknown>
    return { id: String(loc.id ?? ''), name: String(loc.name ?? 'Location') }
  })
}

// ── Bookable services ────────────────────────────────────────────────────────

export interface SquareService {
  variationId: string
  name: string
  durationMinutes: number
  priceCents: number | null
  /** Square requires the variation's version when creating a booking. */
  version: number | null
}

/**
 * The service variations this business actually offers for booking.
 *
 * Filtered on `available_for_booking`: a catalog item that isn't bookable will
 * be refused at booking time, and offering it would produce a slot nobody can
 * take.
 */
export async function listBookableServices(creds: SquareCreds): Promise<SquareService[]> {
  const raw = await call<{ objects?: unknown[] }>(creds, '/v2/catalog/list?types=ITEM_VARIATION')
  const rows = Array.isArray(raw?.objects) ? raw.objects : []

  const out: SquareService[] = []
  for (const r of rows) {
    const obj = r as Record<string, unknown>
    const data = obj.item_variation_data as Record<string, unknown> | undefined
    if (!data || data.available_for_booking !== true) continue

    const money = data.price_money as Record<string, unknown> | undefined
    const durationMs = Number(data.service_duration ?? 0)
    out.push({
      variationId: String(obj.id ?? ''),
      name: String(data.name ?? 'Service'),
      // Square reports service_duration in MILLISECONDS.
      durationMinutes: durationMs > 0 ? Math.round(durationMs / 60000) : 60,
      priceCents: money?.amount != null ? Math.round(Number(money.amount)) : null,
      version: obj.version != null ? Number(obj.version) : null,
    })
  }
  return out
}

// ── Availability ─────────────────────────────────────────────────────────────

export interface SquareSlot {
  /** RFC3339 instant, exactly as Square returned it. */
  startAt: string
  teamMemberId: string | null
}

/**
 * Real open slots, from the business's real calendar.
 *
 * This is the entire point of the integration: everywhere else the app asks a
 * customer to *suggest* a time, because we don't have the diary. Here we do, so
 * the times offered are ones that can actually be taken.
 */
export async function searchAvailability(
  creds: SquareCreds,
  opts: { serviceVariationId: string; startAt: string; endAt: string }
): Promise<SquareSlot[]> {
  if (!creds.locationId) return []

  const raw = await call<{ availabilities?: unknown[] }>(creds, '/v2/bookings/availability/search', {
    method: 'POST',
    body: {
      query: {
        filter: {
          start_at_range: { start_at: opts.startAt, end_at: opts.endAt },
          location_id: creds.locationId,
          segment_filters: [{ service_variation_id: opts.serviceVariationId }],
        },
      },
    },
  })

  const rows = Array.isArray(raw?.availabilities) ? raw.availabilities : []
  return rows
    .map((a) => {
      const av = a as Record<string, unknown>
      const segs = Array.isArray(av.appointment_segments) ? (av.appointment_segments as Record<string, unknown>[]) : []
      return {
        startAt: String(av.start_at ?? ''),
        teamMemberId: segs[0]?.team_member_id ? String(segs[0].team_member_id) : null,
      }
    })
    .filter((s) => !!s.startAt)
}

// ── Customers & bookings ─────────────────────────────────────────────────────

/**
 * Square needs a customer id on a booking, so one is created for the buyer.
 *
 * Idempotency key is derived from the email so a customer who books twice is
 * one person in the vendor's Square account rather than two — the vendor has to
 * live in that customer list afterwards.
 */
export async function ensureCustomer(
  creds: SquareCreds,
  person: { email: string; name?: string | null; phone?: string | null }
): Promise<string> {
  const [given, ...rest] = (person.name ?? '').trim().split(/\s+/)
  const raw = await call<{ customer?: Record<string, unknown> }>(creds, '/v2/customers', {
    method: 'POST',
    body: {
      idempotency_key: `wl-${person.email.trim().toLowerCase()}`.slice(0, 45),
      given_name: given || 'Customer',
      family_name: rest.join(' ') || undefined,
      email_address: person.email,
      phone_number: person.phone || undefined,
    },
  })
  const id = raw?.customer?.id
  if (!id) throw new SquareError('Square did not return a customer', 502)
  return String(id)
}

export async function createBooking(
  creds: SquareCreds,
  opts: {
    startAt: string
    customerId: string
    serviceVariationId: string
    serviceVariationVersion: number | null
    teamMemberId: string | null
    durationMinutes: number
    note?: string | null
  }
): Promise<{ bookingId: string }> {
  const raw = await call<{ booking?: Record<string, unknown> }>(creds, '/v2/bookings', {
    method: 'POST',
    body: {
      booking: {
        start_at: opts.startAt,
        location_id: creds.locationId,
        customer_id: opts.customerId,
        customer_note: opts.note || undefined,
        appointment_segments: [
          {
            team_member_id: opts.teamMemberId,
            service_variation_id: opts.serviceVariationId,
            service_variation_version: opts.serviceVariationVersion,
            duration_minutes: opts.durationMinutes,
          },
        ],
      },
    },
  })
  const id = raw?.booking?.id
  if (!id) throw new SquareError('Square did not return a booking', 502)
  return { bookingId: String(id) }
}

/** Cancel in Square when the booking is cancelled here, or the diary lies. */
export async function cancelBooking(creds: SquareCreds, bookingId: string): Promise<void> {
  await call(creds, `/v2/bookings/${bookingId}/cancel`, { method: 'POST', body: {} })
}
