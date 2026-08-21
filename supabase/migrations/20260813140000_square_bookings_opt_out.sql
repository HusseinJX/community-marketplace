-- Square Appointments can now borrow the OAuth token from the catalog
-- connection (lib/composio-commerce.ts → getStoreAccessToken), so one "Connect
-- Square" lights up both halves.
--
-- That breaks Disconnect. It nulls `square_token`, which was the whole answer
-- while a pasted token was the only source — but a borrowed token is still
-- there afterwards, so bookings would silently come back and the vendor would
-- have no way to keep their catalog synced while turning bookings off.
--
-- Hence an explicit opt-out. It records a decision the token can't: "not through
-- Square", regardless of what the store connection happens to grant.
ALTER TABLE vendor_secrets
  ADD COLUMN IF NOT EXISTS square_bookings_off BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN vendor_secrets.square_bookings_off IS
  'Vendor turned Square Appointments off. Needed because the bookings token may be borrowed from the catalog OAuth connection, which Disconnect must not revoke — they still want their products syncing.';
