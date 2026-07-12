"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

// Fires a test push to the signed-in user's registered devices via /api/push/test.
// Useful for verifying the APNs pipeline end-to-end from the phone.
export function PushTestButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(data.sent > 0 ? `Sent to ${data.sent} device(s) ✓` : "No registered devices yet");
      else setStatus(data.error || "Failed");
    } catch {
      setStatus("Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900 disabled:opacity-60"
      >
        <Bell className="h-4 w-4" /> {busy ? "Sending…" : "Send test notification"}
      </button>
      {status && <span className="text-xs text-stone-500">{status}</span>}
    </div>
  );
}
