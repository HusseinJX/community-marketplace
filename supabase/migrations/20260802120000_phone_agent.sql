-- Inbound phone agent: number lifecycle + metered minutes.
--
-- Two tables, one job each:
--   vendor_phone_numbers — which business owns which number, and its lifecycle
--     (provisioned → releasing after cancel → released). Replaces the hardcoded
--     map in lib/business-phone.ts.
--   voice_minutes — the monthly minute ledger. Minutes (not calls) because
--     Telnyx bills per second with a 60s floor, so calls are the wrong unit.

CREATE TABLE IF NOT EXISTS vendor_phone_numbers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       text NOT NULL,
  e164            text NOT NULL UNIQUE,
  telnyx_id       text,
  -- active     = answering calls
  -- releasing  = subscription cancelled; held during the grace window so a
  --              returning vendor keeps the number printed on their signage
  -- released   = handed back to Telnyx; gone for good
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'releasing', 'released')),
  -- Where to send callers when the agent can't take them (out of minutes,
  -- agent disabled). Their real business line. NULL = no fallback available.
  forward_to      text,
  -- Set when status flips to 'releasing'. The sweeper releases once past this.
  release_after   timestamptz,
  provisioned_at  timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One ACTIVE number per business. A released row stays for history, so the
-- uniqueness is partial rather than a plain UNIQUE on member_id.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_phone_numbers_member_active_idx
  ON vendor_phone_numbers (member_id)
  WHERE status IN ('active', 'releasing');

CREATE INDEX IF NOT EXISTS vendor_phone_numbers_e164_idx
  ON vendor_phone_numbers (e164) WHERE status <> 'released';
CREATE INDEX IF NOT EXISTS vendor_phone_numbers_release_idx
  ON vendor_phone_numbers (release_after) WHERE status = 'releasing';

-- Monthly minute ledger. period = 'YYYY-MM'.
CREATE TABLE IF NOT EXISTS voice_minutes (
  member_id      text NOT NULL,
  period         text NOT NULL,
  -- Seconds, not minutes: Telnyx reports seconds and rounding early loses money.
  included_sec   integer NOT NULL DEFAULT 0,
  -- Top-ups bought when the included allowance runs out. Carries no expiry.
  purchased_sec  integer NOT NULL DEFAULT 0,
  used_sec       integer NOT NULL DEFAULT 0,
  -- Budget alerts are one-shot per period so we don't spam on every call.
  alerted_80     boolean NOT NULL DEFAULT false,
  alerted_100    boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, period)
);

-- Per-call record. Also the idempotency guard: Telnyx can retry a status
-- callback, and without the unique call id we'd double-bill the vendor.
CREATE TABLE IF NOT EXISTS voice_calls (
  call_id      text PRIMARY KEY,
  member_id    text NOT NULL,
  e164         text,
  from_number  text,
  billed_sec   integer NOT NULL DEFAULT 0,
  -- 'agent' = AI answered, 'forwarded' = sent to their real line (cheap path)
  outcome      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_calls_member_idx ON voice_calls (member_id, created_at DESC);

ALTER TABLE vendor_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

-- Service-role only: every writer here is a server route. Anon has no business
-- reading which business owns which number, or editing its own minute balance.
GRANT ALL ON vendor_phone_numbers TO service_role;
GRANT ALL ON voice_minutes TO service_role;
GRANT ALL ON voice_calls TO service_role;
