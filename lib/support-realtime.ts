import { createClient } from "@supabase/supabase-js";

export interface SupportRealtimeConfig {
  url: string;
  anonKey: string;
  channel: string;
}

export function supportRealtimeChannel(threadId: string): string {
  return `support-thread:${threadId}`;
}

export function supportRealtimeConfig(threadId: string): SupportRealtimeConfig | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey, channel: supportRealtimeChannel(threadId) };
}

export async function broadcastSupportThreadChange({
  threadId,
  messageId,
  sender,
  createdAt,
}: {
  threadId: string;
  messageId: string;
  sender: "user" | "staff";
  createdAt: string;
}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  await supabase.channel(supportRealtimeChannel(threadId)).httpSend("message", {
    messageId,
    sender,
    createdAt,
  });
}
