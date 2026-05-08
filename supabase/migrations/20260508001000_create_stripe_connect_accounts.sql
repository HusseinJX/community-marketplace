CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
  member_id TEXT PRIMARY KEY,
  stripe_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  onboarding_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON stripe_connect_accounts
  FOR ALL USING (true) WITH CHECK (true);
