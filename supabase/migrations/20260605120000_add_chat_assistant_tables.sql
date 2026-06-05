-- Per-business AI customer-service assistant: owner-authored knowledge,
-- conversation transcripts, and captured leads.

-- Freeform knowledge entries the business owner adds (FAQs, policies, etc.)
CREATE TABLE business_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX business_knowledge_member_idx ON business_knowledge (member_id);

-- One row per assistant conversation (for analytics + owner inbox + future RAG)
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_conversations_member_idx ON chat_conversations (member_id);

-- Individual messages within a conversation
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL,            -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conversation_idx ON chat_messages (conversation_id);

-- Leads the assistant captured when it couldn't answer / took a message
CREATE TABLE chat_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  name TEXT,
  contact TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_leads_member_idx ON chat_leads (member_id);

-- Per-business assistant configuration lives on vendor_settings
ALTER TABLE vendor_settings ADD COLUMN IF NOT EXISTS assistant_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE vendor_settings ADD COLUMN IF NOT EXISTS assistant_persona TEXT;

-- RLS: mirror the existing open-policy pattern; access is gated in the app layer
ALTER TABLE business_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_knowledge_open" ON business_knowledge FOR ALL USING (true);
CREATE POLICY "chat_conversations_open" ON chat_conversations FOR ALL USING (true);
CREATE POLICY "chat_messages_open" ON chat_messages FOR ALL USING (true);
CREATE POLICY "chat_leads_open" ON chat_leads FOR ALL USING (true);

GRANT ALL ON business_knowledge TO anon, authenticated, service_role;
GRANT ALL ON chat_conversations TO anon, authenticated, service_role;
GRANT ALL ON chat_messages TO anon, authenticated, service_role;
GRANT ALL ON chat_leads TO anon, authenticated, service_role;
