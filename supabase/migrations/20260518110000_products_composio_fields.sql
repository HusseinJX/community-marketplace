-- add Composio sync metadata to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- unique constraint so upsert by (member_id, external_id) is idempotent
CREATE UNIQUE INDEX IF NOT EXISTS products_member_external_id
  ON products (member_id, external_id)
  WHERE external_id IS NOT NULL;
