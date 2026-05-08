CREATE TABLE IF NOT EXISTS vendor_profiles (
  workos_user_id TEXT PRIMARY KEY,
  member_id      TEXT NOT NULL,
  email          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON vendor_profiles
  FOR ALL USING (true) WITH CHECK (true);
