-- Square Appointments: real availability behind the request-to-book flow.
--
-- Square is the ONLY one of Square/Toast/Clover with a real bookings API —
-- Toast has no appointments concept (its reservations are restaurant tables),
-- and Clover has no first-party booking API at all. So this is the one POS
-- booking integration worth having, and it serves exactly the vendors who
-- already run Square Appointments.
--
-- It deliberately CONFIRMS AGAINST `booking_requests` rather than introducing a
-- second booking model. Every booking in this app is a row in that table; Square
-- just means the time offered was real and the confirmation is instant. A vendor
-- without Square keeps the free-text request, and neither the customer UI nor
-- the vendor inbox needs to know which kind it is.

-- Credentials join the Printify token in the service-role-only table. Same
-- reasoning: `vendor_settings` grants SELECT to `anon`, and a Square token can
-- read a business's customers and take bookings in their name.
ALTER TABLE vendor_secrets
  ADD COLUMN IF NOT EXISTS square_token TEXT,
  ADD COLUMN IF NOT EXISTS square_location_id TEXT,
  -- 'production' | 'sandbox'. Explicit rather than sniffed from the token,
  -- because sandbox and production tokens are not reliably distinguishable and
  -- guessing wrong points real customer bookings at a test account (or worse,
  -- the reverse). It also makes this integration verifiable before a real
  -- business is exposed to it.
  ADD COLUMN IF NOT EXISTS square_env TEXT NOT NULL DEFAULT 'production';

ALTER TABLE vendor_secrets DROP CONSTRAINT IF EXISTS vendor_secrets_square_env_check;
ALTER TABLE vendor_secrets
  ADD CONSTRAINT vendor_secrets_square_env_check
  CHECK (square_env IN ('production', 'sandbox'));

COMMENT ON COLUMN vendor_secrets.square_env IS
  'production | sandbox — picks the API host. Explicit because the two token types are not reliably distinguishable, and guessing sends real bookings to a test account.';

-- What Square called the booking, so it can be cancelled or looked up later,
-- and so a retry does not double-book.
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS square_booking_id TEXT,
  -- The service variation booked. Square prices and schedules a VARIATION (a
  -- 45-minute cut vs a 90-minute colour), not a service, so this is what an
  -- availability search and a booking both have to name.
  ADD COLUMN IF NOT EXISTS square_service_variation_id TEXT,
  ADD COLUMN IF NOT EXISTS square_team_member_id TEXT,
  -- The exact instant Square holds, alongside our human-readable date/time.
  -- booking_requests.requested_time is free text on purpose; this is not.
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS booking_requests_square_idx ON booking_requests (square_booking_id);

COMMENT ON COLUMN booking_requests.starts_at IS
  'Exact start when the slot came from a real calendar (Square). NULL for a free-text request, where no precise time was ever agreed.';
