-- Event ticketing: paid tickets + QR check-in, built on the same Stripe Connect
-- rails as the shop.
--
-- Two tables, and the split matters:
--   event_ticket_types = what the organizer SELLS (a price tier, with stock)
--   event_tickets      = what a person HOLDS (one row per admitted head)
--
-- A free RSVP issues a ticket too — that is the whole point. Check-in has to
-- work at a free event exactly as it does at a paid one, so "free" is a
-- price_cents = 0 ticket type rather than a separate code path. Without that,
-- the door scanner would only work for events that took money.
--
-- One row per ADMITTED HEAD, not per order: a party of 4 gets 4 tickets, each
-- with its own token, because they may arrive separately and the door needs to
-- count people, not receipts.

CREATE TABLE IF NOT EXISTS event_ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,                    -- vendor_events.id
  member_id text NOT NULL,                   -- the host (owns the money + the door)
  name text NOT NULL,                        -- "General admission", "Early bird"
  description text,
  price_cents integer NOT NULL DEFAULT 0,    -- 0 = free tier (RSVP)
  currency text NOT NULL DEFAULT 'usd',
  quantity integer,                          -- null = unlimited
  max_per_order integer NOT NULL DEFAULT 10,
  sales_end text,                            -- optional ISO date; free-text to match event_date
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_ticket_types_event_idx ON event_ticket_types (event_id, active);

CREATE TABLE IF NOT EXISTS event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The unguessable half. This is what the QR encodes and what the emailed
  -- link carries, so it IS the access control for a guest with no account —
  -- same rule as an unlisted YouTube URL. Never render it in a public list.
  token text NOT NULL UNIQUE,
  -- The human half. Read aloud at the door when a phone is dead or the camera
  -- won't focus; short enough to type, not secret on its own.
  code text NOT NULL,
  event_id text NOT NULL,
  member_id text NOT NULL,
  ticket_type_id uuid REFERENCES event_ticket_types(id) ON DELETE SET NULL,
  -- Denormalized so a ticket still reads correctly after the organizer renames
  -- or deletes the tier it was sold under.
  ticket_type_name text,
  order_id uuid,                             -- orders.id, null for free tickets
  payment_intent_id text,                    -- idempotency key for issuance
  buyer_email text,
  buyer_name text,
  attendee_id text,                          -- Clerk user id when the holder has an account
  price_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'issued',     -- issued | checked_in | cancelled | refunded
  checked_in_at timestamptz,
  checked_in_by text,                        -- Clerk user id of whoever scanned it
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_tickets_event_idx ON event_tickets (event_id, status);
CREATE INDEX IF NOT EXISTS event_tickets_attendee_idx ON event_tickets (attendee_id);
CREATE INDEX IF NOT EXISTS event_tickets_email_idx ON event_tickets (buyer_email);
CREATE INDEX IF NOT EXISTS event_tickets_pi_idx ON event_tickets (payment_intent_id);
CREATE INDEX IF NOT EXISTS event_tickets_code_idx ON event_tickets (code);

-- A ticket order is still an order (it belongs in the vendor's Payments view),
-- but it is fulfilled at a door, not by a courier or a counter — so it needs
-- its own fulfillment_type. Leaving it as 'pickup' would have put "Mark Ready"
-- on a concert ticket.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_id text;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_type_check
  CHECK (fulfillment_type IN ('pickup', 'delivery', 'ticket'));

COMMENT ON COLUMN orders.fulfillment_type IS
  'pickup (default) | delivery | ticket. Chosen before payment. delivery requires uber_direct_enabled + platform Uber creds; ticket means the buyer is admitted at the door via QR check-in.';

ALTER TABLE event_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

-- Grants mirror the rest of the app's tables: the server writes with the
-- service-role key (falling back to anon), and RLS is open because every read
-- and write already goes through a resolveActor-gated route. Note the anon
-- grant is why event_tickets.token must never appear in a public payload.
CREATE POLICY event_ticket_types_open ON event_ticket_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY event_tickets_open ON event_tickets FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON event_ticket_types TO anon, authenticated, service_role;
GRANT ALL ON event_tickets TO anon, authenticated, service_role;
