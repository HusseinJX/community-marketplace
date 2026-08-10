import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { SITE_URL } from './seo'

// Ticketing data layer: ticket types (what's for sale) and tickets (what people
// hold). Paid and free share this one path — a free RSVP issues a real ticket
// with a real QR, so the door scanner behaves identically at a $0 event.

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

export type TicketStatus = 'issued' | 'checked_in' | 'cancelled' | 'refunded'

export interface TicketType {
  id: string
  event_id: string
  member_id: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  quantity: number | null
  max_per_order: number
  sales_end: string | null
  active: boolean
  sort_order: number
  created_at: string
}

export interface Ticket {
  id: string
  token: string
  code: string
  event_id: string
  member_id: string
  ticket_type_id: string | null
  ticket_type_name: string | null
  order_id: string | null
  payment_intent_id: string | null
  buyer_email: string | null
  buyer_name: string | null
  attendee_id: string | null
  price_cents: number
  status: TicketStatus
  checked_in_at: string | null
  checked_in_by: string | null
  created_at: string
}

/** A ticket type plus live stock. `remaining: null` means unlimited. */
export interface TicketTypeAvailability extends TicketType {
  sold: number
  remaining: number | null
  soldOut: boolean
  closed: boolean
}

// ─── Codes ───────────────────────────────────────────────────────────────────

// The QR/email secret. 128 bits of entropy in base64url: this is the only thing
// standing between a stranger and someone else's ticket, because a guest buyer
// has no account to authenticate against.
function newToken(): string {
  return randomBytes(16).toString('base64url')
}

// The spoken/typed fallback. Crockford-ish alphabet — no I, O, 0, 1, so a
// doorman reading it off a phone screen can't transcribe it wrong.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
function newCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return `${out.slice(0, 4)}-${out.slice(4)}`
}

/** The URL a ticket's QR encodes and its email links to. */
export function ticketUrl(token: string): string {
  return `${SITE_URL}/tickets/${token}`
}

// ─── Ticket types ────────────────────────────────────────────────────────────

export async function getTicketTypes(eventId: string, includeInactive = false): Promise<TicketType[]> {
  let q = db().from('event_ticket_types').select('*').eq('event_id', eventId)
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q.order('sort_order', { ascending: true }).order('price_cents', { ascending: true })
  if (error || !data) return []
  return data as TicketType[]
}

export async function getTicketType(id: string): Promise<TicketType | null> {
  const { data } = await db().from('event_ticket_types').select('*').eq('id', id).maybeSingle()
  return (data as TicketType) ?? null
}

export async function createTicketType(
  eventId: string,
  memberId: string,
  t: {
    name: string
    description?: string | null
    price_cents: number
    quantity?: number | null
    max_per_order?: number
    sales_end?: string | null
    sort_order?: number
  }
): Promise<TicketType> {
  const { data, error } = await db()
    .from('event_ticket_types')
    .insert({
      event_id: eventId,
      member_id: memberId,
      name: t.name.trim() || 'General admission',
      description: t.description ?? null,
      price_cents: Math.max(0, Math.round(t.price_cents || 0)),
      quantity: t.quantity == null ? null : Math.max(0, Math.round(t.quantity)),
      max_per_order: Math.min(50, Math.max(1, Math.round(t.max_per_order || 10))),
      sales_end: t.sales_end ?? null,
      sort_order: t.sort_order ?? 0,
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create ticket type: ${error?.message}`)
  return data as TicketType
}

export async function updateTicketType(
  id: string,
  memberId: string,
  fields: Partial<Pick<TicketType, 'name' | 'description' | 'price_cents' | 'quantity' | 'max_per_order' | 'sales_end' | 'active' | 'sort_order'>>
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.price_cents !== undefined) patch.price_cents = Math.max(0, Math.round(fields.price_cents))
  if (fields.quantity !== undefined) patch.quantity = fields.quantity == null ? null : Math.max(0, Math.round(fields.quantity))
  if (fields.max_per_order !== undefined) patch.max_per_order = Math.min(50, Math.max(1, Math.round(fields.max_per_order)))
  if (fields.sales_end !== undefined) patch.sales_end = fields.sales_end
  if (fields.active !== undefined) patch.active = fields.active
  if (fields.sort_order !== undefined) patch.sort_order = fields.sort_order

  const { error } = await db().from('event_ticket_types').update(patch).eq('id', id).eq('member_id', memberId)
  if (error) throw new Error(`Failed to update ticket type: ${error.message}`)
}

/**
 * Deleting a tier that has already sold would orphan real tickets, so this
 * deactivates instead once any exist. The holder keeps a valid ticket; the tier
 * just stops selling.
 */
export async function deleteTicketType(id: string, memberId: string): Promise<{ deleted: boolean }> {
  const sold = await soldCountForType(id)
  if (sold > 0) {
    await updateTicketType(id, memberId, { active: false })
    return { deleted: false }
  }
  const { error } = await db().from('event_ticket_types').delete().eq('id', id).eq('member_id', memberId)
  if (error) throw new Error(`Failed to delete ticket type: ${error.message}`)
  return { deleted: true }
}

// ─── Availability ────────────────────────────────────────────────────────────

// Cancelled and refunded tickets free their seat back up; checked-in ones do
// not (that seat is a person standing in the room).
const LIVE_STATUSES: TicketStatus[] = ['issued', 'checked_in']

export async function soldCountForType(ticketTypeId: string): Promise<number> {
  const { count } = await db()
    .from('event_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_type_id', ticketTypeId)
    .in('status', LIVE_STATUSES)
  return count ?? 0
}

async function soldByType(eventId: string): Promise<Map<string, number>> {
  const { data } = await db()
    .from('event_tickets')
    .select('ticket_type_id')
    .eq('event_id', eventId)
    .in('status', LIVE_STATUSES)
  const map = new Map<string, number>()
  for (const row of (data ?? []) as { ticket_type_id: string | null }[]) {
    if (!row.ticket_type_id) continue
    map.set(row.ticket_type_id, (map.get(row.ticket_type_id) ?? 0) + 1)
  }
  return map
}

function salesClosed(t: TicketType): boolean {
  if (!t.sales_end) return false
  const end = Date.parse(t.sales_end)
  if (Number.isNaN(end)) return false // free-text we can't read is not a closed sale
  return Date.now() > end
}

export async function getAvailability(eventId: string): Promise<TicketTypeAvailability[]> {
  const [types, sold] = await Promise.all([getTicketTypes(eventId), soldByType(eventId)])
  return types.map((t) => {
    const n = sold.get(t.id) ?? 0
    const remaining = t.quantity == null ? null : Math.max(0, t.quantity - n)
    return { ...t, sold: n, remaining, soldOut: remaining === 0, closed: salesClosed(t) }
  })
}

/** Total live tickets issued for an event — the headcount the door expects. */
export async function getIssuedCount(eventId: string): Promise<number> {
  const { count } = await db()
    .from('event_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', LIVE_STATUSES)
  return count ?? 0
}

export async function getCheckedInCount(eventId: string): Promise<number> {
  const { count } = await db()
    .from('event_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'checked_in')
  return count ?? 0
}

// ─── Issuing ─────────────────────────────────────────────────────────────────

export interface IssueLine {
  ticketTypeId: string | null
  ticketTypeName: string | null
  priceCents: number
  quantity: number
}

export interface IssueOpts {
  eventId: string
  memberId: string
  lines: IssueLine[]
  buyerEmail?: string | null
  buyerName?: string | null
  attendeeId?: string | null
  orderId?: string | null
  paymentIntentId?: string | null
}

/**
 * Issue tickets. Idempotent on paymentIntentId: the browser's confirm call and
 * the Stripe webhook both land here for a paid order, and whichever arrives
 * second must not mint a second set of tickets.
 */
export async function issueTickets(opts: IssueOpts): Promise<Ticket[]> {
  if (opts.paymentIntentId) {
    const existing = await getTicketsByPaymentIntent(opts.paymentIntentId)
    if (existing.length > 0) return existing
  }

  const rows = opts.lines.flatMap((line) =>
    Array.from({ length: Math.max(0, Math.round(line.quantity)) }, () => ({
      token: newToken(),
      code: newCode(),
      event_id: opts.eventId,
      member_id: opts.memberId,
      ticket_type_id: line.ticketTypeId,
      ticket_type_name: line.ticketTypeName,
      order_id: opts.orderId ?? null,
      payment_intent_id: opts.paymentIntentId ?? null,
      buyer_email: opts.buyerEmail ?? null,
      buyer_name: opts.buyerName ?? null,
      attendee_id: opts.attendeeId ?? null,
      price_cents: Math.max(0, Math.round(line.priceCents)),
      status: 'issued' as const,
    }))
  )
  if (rows.length === 0) return []

  const { data, error } = await db().from('event_tickets').insert(rows).select()
  if (error || !data) throw new Error(`Failed to issue tickets: ${error?.message}`)
  return data as Ticket[]
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export async function getTicketByToken(token: string): Promise<Ticket | null> {
  const { data } = await db().from('event_tickets').select('*').eq('token', token).maybeSingle()
  return (data as Ticket) ?? null
}

export async function getTicketsByPaymentIntent(paymentIntentId: string): Promise<Ticket[]> {
  const { data } = await db()
    .from('event_tickets')
    .select('*')
    .eq('payment_intent_id', paymentIntentId)
    .order('created_at', { ascending: true })
  return (data ?? []) as Ticket[]
}

export async function getTicketsForEvent(eventId: string): Promise<Ticket[]> {
  const { data } = await db()
    .from('event_tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return (data ?? []) as Ticket[]
}

/** Everything a signed-in person holds, newest event activity first. */
export async function getTicketsForAttendee(attendeeId: string): Promise<Ticket[]> {
  const { data } = await db()
    .from('event_tickets')
    .select('*')
    .eq('attendee_id', attendeeId)
    .in('status', LIVE_STATUSES)
    .order('created_at', { ascending: false })
  return (data ?? []) as Ticket[]
}

export async function getTicketsForEmail(email: string): Promise<Ticket[]> {
  const { data } = await db()
    .from('event_tickets')
    .select('*')
    .eq('buyer_email', email.trim().toLowerCase())
    .in('status', LIVE_STATUSES)
    .order('created_at', { ascending: false })
  return (data ?? []) as Ticket[]
}

/**
 * Claim previously-guest tickets for a person who has since signed in with the
 * same address. Without this, someone who bought as a guest and later made an
 * account would never see the ticket in their account.
 */
export async function linkTicketsToAccount(email: string, attendeeId: string): Promise<number> {
  const { data, error } = await db()
    .from('event_tickets')
    .update({ attendee_id: attendeeId })
    .eq('buyer_email', email.trim().toLowerCase())
    .is('attendee_id', null)
    .select('id')
  if (error) return 0
  return (data ?? []).length
}

// ─── Check-in ────────────────────────────────────────────────────────────────

export type CheckInResult =
  | { ok: true; ticket: Ticket; alreadyIn: false }
  | { ok: false; reason: 'not_found' | 'wrong_event' | 'already_in' | 'void'; ticket: Ticket | null; alreadyIn: boolean }

/**
 * Admit one ticket at the door.
 *
 * A second scan of the same ticket is a REFUSAL, not a no-op — that is the
 * entire fraud story for a screenshotted QR passed to a friend, so the door
 * staff must see "already used at 8:12pm", not a green tick.
 *
 * Scoped to the event AND the host's member id: an organizer scanning at their
 * own door can never admit (or burn) a ticket belonging to someone else's event.
 */
export async function checkInTicket(
  tokenOrCode: string,
  eventId: string,
  memberId: string,
  by: string
): Promise<CheckInResult> {
  const ticket = await findTicketForDoor(tokenOrCode, eventId)
  if (!ticket) return { ok: false, reason: 'not_found', ticket: null, alreadyIn: false }
  if (ticket.event_id !== eventId || ticket.member_id !== memberId) {
    return { ok: false, reason: 'wrong_event', ticket, alreadyIn: false }
  }
  if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
    return { ok: false, reason: 'void', ticket, alreadyIn: false }
  }
  if (ticket.status === 'checked_in') {
    return { ok: false, reason: 'already_in', ticket, alreadyIn: true }
  }

  const now = new Date().toISOString()
  // Conditional on status still being 'issued' so two doors scanning the same
  // ticket at the same moment can't both report success.
  const { data, error } = await db()
    .from('event_tickets')
    .update({ status: 'checked_in', checked_in_at: now, checked_in_by: by })
    .eq('id', ticket.id)
    .eq('status', 'issued')
    .select()
  if (error) throw new Error(`Check-in failed: ${error.message}`)
  if (!data || data.length === 0) {
    const fresh = await getTicketByToken(ticket.token)
    return { ok: false, reason: 'already_in', ticket: fresh ?? ticket, alreadyIn: true }
  }
  return { ok: true, ticket: (data[0] as Ticket), alreadyIn: false }
}

/**
 * Resolve what the scanner just read. Accepts a raw token, a full ticket URL
 * (what the QR actually encodes), or the short human code — the door staff will
 * type the last of these when a phone screen is too dim to scan.
 */
async function findTicketForDoor(input: string, eventId: string): Promise<Ticket | null> {
  const raw = input.trim()
  if (!raw) return null

  // A scanned QR is a URL; pull the token out of its last path segment.
  let token = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parts = new URL(raw).pathname.split('/').filter(Boolean)
      token = parts[parts.length - 1] ?? ''
    } catch {
      token = ''
    }
  }
  if (token) {
    const byToken = await getTicketByToken(token)
    if (byToken) return byToken
  }

  // Fall back to the short code. Case- and dash-insensitive, and scoped to this
  // event because the code is short enough to collide across events.
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (normalized.length < 6) return null
  const withDash = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`
  const { data } = await db()
    .from('event_tickets')
    .select('*')
    .eq('event_id', eventId)
    .eq('code', withDash)
    .maybeSingle()
  return (data as Ticket) ?? null
}

/** Undo an admission — the door staff's "oops, wrong person". */
export async function undoCheckIn(ticketId: string, memberId: string): Promise<void> {
  const { error } = await db()
    .from('event_tickets')
    .update({ status: 'issued', checked_in_at: null, checked_in_by: null })
    .eq('id', ticketId)
    .eq('member_id', memberId)
    .eq('status', 'checked_in')
  if (error) throw new Error(`Failed to undo check-in: ${error.message}`)
}

export async function cancelTicketsForPaymentIntent(paymentIntentId: string, status: 'refunded' | 'cancelled' = 'refunded'): Promise<void> {
  await db()
    .from('event_tickets')
    .update({ status })
    .eq('payment_intent_id', paymentIntentId)
    .in('status', LIVE_STATUSES)
}

// ─── Free RSVP ↔ tickets ─────────────────────────────────────────────────────

/**
 * Keep a free RSVP's tickets in step with its party size.
 *
 * An RSVP is a promise to come; a ticket is the thing that gets scanned at the
 * door. Every event needs the second one, so a free event's RSVP mints real
 * tickets — one per head, since a party of four arrives as four people. Growing
 * a party issues the difference; shrinking it cancels the newest surplus rather
 * than reissuing, so codes already sent to someone's phone stay valid.
 */
export async function syncRsvpTickets(opts: {
  eventId: string
  memberId: string
  attendeeId: string
  partySize: number
  email?: string | null
  name?: string | null
  ticketTypeId?: string | null
  ticketTypeName?: string | null
}): Promise<Ticket[]> {
  const want = Math.max(0, Math.round(opts.partySize))
  const { data } = await db()
    .from('event_tickets')
    .select('*')
    .eq('event_id', opts.eventId)
    .eq('attendee_id', opts.attendeeId)
    .in('status', LIVE_STATUSES)
    .order('created_at', { ascending: true })
  const held = (data ?? []) as Ticket[]

  if (held.length === want) return held
  if (held.length > want) {
    // Cancel from the end — never burn a code someone is already holding.
    const surplus = held.slice(want).filter((t) => t.status === 'issued')
    if (surplus.length > 0) {
      await db().from('event_tickets').update({ status: 'cancelled' }).in('id', surplus.map((t) => t.id))
    }
    return held.slice(0, want)
  }

  const issued = await issueTickets({
    eventId: opts.eventId,
    memberId: opts.memberId,
    lines: [
      {
        ticketTypeId: opts.ticketTypeId ?? null,
        ticketTypeName: opts.ticketTypeName ?? 'RSVP',
        priceCents: 0,
        quantity: want - held.length,
      },
    ],
    buyerEmail: opts.email ?? null,
    buyerName: opts.name ?? null,
    attendeeId: opts.attendeeId,
  })
  return [...held, ...issued]
}

/** Void an RSVP's tickets when they cancel. */
export async function cancelRsvpTickets(eventId: string, attendeeId: string): Promise<void> {
  await db()
    .from('event_tickets')
    .update({ status: 'cancelled' })
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .eq('status', 'issued')
}

/**
 * A stable attendee id for someone with no account. Derived from the email so
 * the same guest buying twice lands on one RSVP row instead of two, and so
 * nothing about it needs storing separately.
 */
export function guestAttendeeId(email: string): string {
  const normalized = email.trim().toLowerCase()
  return `guest:${createHash('sha256').update(normalized).digest('hex').slice(0, 32)}`
}

// ─── Public shapes ───────────────────────────────────────────────────────────

/**
 * What a browser is allowed to see about a ticket type. Strips member_id and
 * raw stock counts; the buyer needs "6 left", not the organizer's inventory.
 */
export function publicTicketType(t: TicketTypeAvailability) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.price_cents,
    currency: t.currency,
    remaining: t.remaining,
    soldOut: t.soldOut,
    closed: t.closed,
    maxPerOrder: t.max_per_order,
  }
}
