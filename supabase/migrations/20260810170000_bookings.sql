-- Request to book: a customer proposes a time, the business agrees.
--
-- Until now the "Book" button on every business profile opened `BookFlow` from
-- app/prototype — hardcoded venues, zero API calls, nothing stored, nobody
-- notified. A customer could "book" and no one would ever know.
--
-- This is deliberately NOT a calendar. There is no availability engine, no
-- slots, no double-booking logic, because none of that can be true without the
-- business's real diary — and inventing availability is a worse lie than asking.
-- What it models is the conversation that actually happens: "could I come
-- Thursday around 2?" → "yes" / "not then, how about Friday?".
--
-- It is also the substrate any POS booking integration would write into: Square
-- Appointments (the only one of Square/Toast/Clover with a real bookings API)
-- would confirm against these rows rather than needing a parallel model.

CREATE TABLE IF NOT EXISTS booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL,
  -- The service being booked, when it came from the catalog. NULL for a plain
  -- "book with this business" from the profile.
  product_id uuid,
  service_name text,

  -- Clerk user id, or `guest:<hash>` — booking a haircut should not require an
  -- account, the same rule as buying a ticket.
  customer_id text,
  customer_name text,
  customer_email text,
  customer_phone text,

  -- What the customer asked for. Date is sortable ISO; time stays FREE TEXT
  -- because "afternoon" and "after 5" are real answers and forcing a picker
  -- would make people lie to the form.
  requested_date text,
  requested_time text,
  -- A second option, so a "no" doesn't cost another round trip.
  alt_date text,
  alt_time text,
  note text,

  -- requested → confirmed | declined ; confirmed → completed | cancelled
  status text NOT NULL DEFAULT 'requested',
  -- What the business actually agreed to, which may differ from what was asked.
  confirmed_date text,
  confirmed_time text,
  vendor_note text,

  -- Set when the service was paid for up front (a `kind='service'` product).
  order_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_requests DROP CONSTRAINT IF EXISTS booking_requests_status_check;
ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_status_check
  CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'completed'));

CREATE INDEX IF NOT EXISTS booking_requests_member_idx ON booking_requests (member_id, status);
CREATE INDEX IF NOT EXISTS booking_requests_customer_idx ON booking_requests (customer_id);
CREATE INDEX IF NOT EXISTS booking_requests_date_idx ON booking_requests (requested_date);

COMMENT ON TABLE booking_requests IS
  'Request-to-book: the customer proposes a time and the business agrees. NOT a calendar — no availability, no slots. A POS booking integration (Square Appointments) should confirm against these rows rather than introduce a second model.';
COMMENT ON COLUMN booking_requests.requested_time IS
  'Free text on purpose — "afternoon" and "after 5" are real answers, and a strict picker makes people lie to the form.';

ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_requests_open ON booking_requests FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON booking_requests TO anon, authenticated, service_role;
