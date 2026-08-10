-- Digital delivery: the file, and the grant that lets one buyer fetch it.
--
-- `products.kind = 'digital'` shipped in 20260810140000 but was hidden from the
-- vendor picker, because the checkout already promised "we'll email your
-- download link" and nothing sent one. This is that missing half.

-- ── The file ─────────────────────────────────────────────────────────────────
-- One file per digital product. Deliberately columns rather than a
-- product_files table: a second file is a second product until someone actually
-- needs bundles, and a nullable join table would let a digital product exist
-- with nothing attached.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS digital_file_path TEXT,
  ADD COLUMN IF NOT EXISTS digital_file_name TEXT,
  ADD COLUMN IF NOT EXISTS digital_file_size INTEGER;

COMMENT ON COLUMN products.digital_file_path IS
  'Object path inside the PRIVATE digital-goods bucket. Never a public URL — the buyer only ever gets a signed URL minted per download, so the file cannot be shared by copying a link out of an email.';

-- ── The grant ────────────────────────────────────────────────────────────────
-- One row per (buyer, product) purchase. This is what the emailed link
-- addresses, and it is the ONLY thing standing between a stranger and the file,
-- exactly like an event ticket's token — so it carries the same 128 bits.
CREATE TABLE IF NOT EXISTS digital_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  order_id uuid,
  payment_intent_id text,
  member_id text NOT NULL,
  product_id uuid,
  -- Denormalized so a grant still reads correctly (and still resolves a file)
  -- after the vendor renames, re-uploads or deletes the product. A buyer paid
  -- for this; it must not stop working because the catalog moved on.
  product_name text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  buyer_email text,
  attendee_id text,
  download_count integer NOT NULL DEFAULT 0,
  -- NULL = unlimited. A cap is the vendor's choice, not a default we impose:
  -- someone re-downloading an ebook on a new phone two years later is the
  -- normal case, not abuse.
  max_downloads integer,
  expires_at timestamptz,
  last_downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_grants_pi_idx ON digital_grants (payment_intent_id);
CREATE INDEX IF NOT EXISTS digital_grants_email_idx ON digital_grants (buyer_email);
CREATE INDEX IF NOT EXISTS digital_grants_attendee_idx ON digital_grants (attendee_id);

ALTER TABLE digital_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY digital_grants_open ON digital_grants FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON digital_grants TO anon, authenticated, service_role;

-- ── The bucket ───────────────────────────────────────────────────────────────
-- PRIVATE, unlike marketplace-media. A public bucket would mean the object URL
-- is the product: paste it anywhere and the paywall is gone forever. Everything
-- is served through a signed URL minted per download instead, so a leaked link
-- dies in minutes rather than never.
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-goods', 'digital-goods', false)
ON CONFLICT (id) DO NOTHING;

-- No anon/authenticated policies on purpose: nothing reads this bucket from a
-- browser. The server signs every URL with the service-role key.
