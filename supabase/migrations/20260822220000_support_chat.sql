-- Support chat: a person talks to us, we talk back.
--
-- One thread PER PERSON, not per topic. Support is a relationship, not a
-- ticket queue: someone who wrote last month about a payout and today about a
-- photo is the same conversation to them, and splitting it means we lose what
-- we already know about them. `clerk_user_id` is therefore UNIQUE.
--
-- Signed-in only, by design — a support conversation with an anonymous device
-- has nobody to reply to.
CREATE TABLE IF NOT EXISTS support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  -- Denormalized so the admin inbox can render a list without a Clerk lookup
  -- per row. Refreshed every time the person writes.
  display_name TEXT,
  email TEXT,
  -- Their business, when they have one — the answer to most support questions
  -- starts with knowing which vendor is asking.
  member_id TEXT,
  last_message_at TIMESTAMPTZ,
  last_sender TEXT,
  preview TEXT,
  -- Unread as COUNTERS rather than a read-timestamp + count(*) per thread: the
  -- badge is polled by every signed-in person on every tab, and that read has
  -- to be one row, not an aggregate over a table that only grows. Every write
  -- goes through lib/support.ts, which is what keeps them honest.
  user_unread INT NOT NULL DEFAULT 0,
  staff_unread INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  -- 'user' or 'staff'. Not a clerk id: who on our side answered is
  -- `author_name`, and the side it came from is what the bubble alignment and
  -- the unread counters key on.
  sender TEXT NOT NULL CHECK (sender IN ('user', 'staff')),
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON support_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS support_threads_recent_idx ON support_threads (last_message_at DESC NULLS LAST);

-- service_role ONLY, like vendor_secrets and shopper_taste. These rows hold
-- whatever a person chose to tell support — an address, an order, a complaint
-- about a neighbour — and the anon key is in every browser that loads the site.
-- RLS with NO policy denies by default; that is deliberate, not an omission.
ALTER TABLE support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_threads FROM anon, authenticated;
REVOKE ALL ON support_messages FROM anon, authenticated;
GRANT ALL ON support_threads TO service_role;
GRANT ALL ON support_messages TO service_role;

COMMENT ON TABLE support_threads IS
  'One support conversation per signed-in person (clerk_user_id UNIQUE). service_role ONLY — never grant anon/authenticated.';
COMMENT ON COLUMN support_threads.user_unread IS
  'Staff messages this person has not opened. Drives the red badge on the support card; reset by PATCH /api/support.';
