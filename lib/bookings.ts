import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// Request-to-book. See migration 20260810170000 for why this is not a calendar.

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed'

export interface BookingRequest {
  id: string
  member_id: string
  product_id: string | null
  service_name: string | null
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  requested_date: string | null
  requested_time: string | null
  alt_date: string | null
  alt_time: string | null
  note: string | null
  status: BookingStatus
  confirmed_date: string | null
  confirmed_time: string | null
  vendor_note: string | null
  order_id: string | null
  /** Set when the slot came from a real calendar (Square Appointments). */
  square_booking_id: string | null
  square_service_variation_id: string | null
  square_team_member_id: string | null
  starts_at: string | null
  created_at: string
  updated_at: string
}

/** Stable id for a customer with no account, derived from their email. */
export function guestCustomerId(email: string): string {
  return `guest:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32)}`
}

export async function createBookingRequest(input: {
  memberId: string
  productId?: string | null
  serviceName?: string | null
  customerId: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  requestedDate?: string | null
  requestedTime?: string | null
  altDate?: string | null
  altTime?: string | null
  note?: string | null
  orderId?: string | null
  /** Present only when a real slot was taken — see square-appointments. */
  squareBookingId?: string | null
  squareServiceVariationId?: string | null
  squareTeamMemberId?: string | null
  startsAt?: string | null
  /** A slot taken from a real calendar is already agreed; nothing to confirm. */
  status?: BookingStatus
}): Promise<BookingRequest> {
  const { data, error } = await db()
    .from('booking_requests')
    .insert({
      member_id: input.memberId,
      product_id: input.productId ?? null,
      service_name: input.serviceName ?? null,
      customer_id: input.customerId,
      customer_name: input.customerName ?? null,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      requested_date: input.requestedDate ?? null,
      requested_time: input.requestedTime ?? null,
      alt_date: input.altDate ?? null,
      alt_time: input.altTime ?? null,
      note: input.note?.slice(0, 1000) ?? null,
      order_id: input.orderId ?? null,
      square_booking_id: input.squareBookingId ?? null,
      square_service_variation_id: input.squareServiceVariationId ?? null,
      square_team_member_id: input.squareTeamMemberId ?? null,
      starts_at: input.startsAt ?? null,
      // A slot booked into a real calendar is confirmed on arrival — asking the
      // vendor to re-approve a time Square already reserved would be theatre.
      status: input.status ?? 'requested',
      confirmed_date: input.status === 'confirmed' ? input.requestedDate ?? null : null,
      confirmed_time: input.status === 'confirmed' ? input.requestedTime ?? null : null,
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create booking request: ${error?.message}`)
  return data as BookingRequest
}

/**
 * The business's requests. Open ones first regardless of date — an unanswered
 * request is the only thing here that needs the owner to DO something, and
 * burying it under next month's confirmed bookings is how people get ignored.
 */
export async function getBookingsForMember(memberId: string): Promise<BookingRequest[]> {
  const { data } = await db()
    .from('booking_requests')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as BookingRequest[]
  return [...rows].sort((a, b) => {
    const open = (r: BookingRequest) => (r.status === 'requested' ? 0 : 1)
    if (open(a) !== open(b)) return open(a) - open(b)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })
}

export async function getBookingsForCustomer(customerId: string): Promise<BookingRequest[]> {
  const { data } = await db()
    .from('booking_requests')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as BookingRequest[]
}

export async function getBooking(id: string): Promise<BookingRequest | null> {
  const { data } = await db().from('booking_requests').select('*').eq('id', id).maybeSingle()
  return (data as BookingRequest) ?? null
}

/**
 * Answer a request. Scoped to the member, so a business can only ever act on
 * its own bookings.
 *
 * Confirming may name a DIFFERENT time from the one asked for — "not Thursday,
 * but Friday at 2 works" is the most common real answer, and forcing a decline
 * plus a fresh request would lose the thread.
 */
export async function setBookingStatus(
  id: string,
  memberId: string,
  status: BookingStatus,
  opts: { confirmedDate?: string | null; confirmedTime?: string | null; vendorNote?: string | null } = {}
): Promise<BookingRequest | null> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (opts.confirmedDate !== undefined) patch.confirmed_date = opts.confirmedDate
  if (opts.confirmedTime !== undefined) patch.confirmed_time = opts.confirmedTime
  if (opts.vendorNote !== undefined) patch.vendor_note = opts.vendorNote?.slice(0, 500) ?? null

  const { data, error } = await db()
    .from('booking_requests')
    .update(patch)
    .eq('id', id)
    .eq('member_id', memberId)
    .select()
  if (error) throw new Error(`Failed to update booking: ${error.message}`)
  return (data?.[0] as BookingRequest) ?? null
}

/** A customer standing down their own request. */
export async function cancelBooking(id: string, customerId: string): Promise<boolean> {
  const { data } = await db()
    .from('booking_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('customer_id', customerId)
    .in('status', ['requested', 'confirmed'])
    .select('*')
  const row = (data ?? [])[0] as BookingRequest | undefined
  if (!row) return false
  // A booking cancelled here but left standing in Square means the business
  // holds a slot for someone who isn't coming — the diary has to agree.
  void releaseSquareSlot(row)
  return true
}

/**
 * Give a real calendar slot back. Best-effort and fire-and-forget: the
 * cancellation in our own records has already succeeded, and a Square outage
 * must not make it look like it failed.
 */
export async function releaseSquareSlot(booking: BookingRequest): Promise<void> {
  if (!booking.square_booking_id) return
  try {
    const { getSquareCreds, cancelBooking: cancelSquare } = await import('./square-appointments')
    const creds = await getSquareCreds(booking.member_id)
    if (creds) await cancelSquare(creds, booking.square_booking_id)
  } catch (e) {
    console.error('could not release the Square slot:', e)
  }
}

/** How a booking's agreed time should read, falling back to what was asked. */
export function bookingWhen(b: BookingRequest): string {
  const date = b.confirmed_date ?? b.requested_date
  const time = b.confirmed_time ?? b.requested_time
  return [date, time].filter(Boolean).join(' · ') || 'Time to be agreed'
}
