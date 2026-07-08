"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";

// In-app account deletion entry point (App Store 5.1.1(v)). Two-step confirm so
// it can't be triggered accidentally, then deletes the account and signs out.
export function DeleteAccountButton() {
  const { signOut } = useClerk();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not delete your account.");
      }
      // Account is gone — clear the session and land home.
      await signOut({ redirectUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-400 transition hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
        Delete account
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-900">Delete your account?</p>
      <p className="mt-1 text-sm text-red-700">
        This permanently removes your account and personal data. This can&apos;t be undone.
      </p>
      {error && <p className="mt-2 text-sm font-medium text-red-800">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={del}
          disabled={busy}
          className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-stone-600 transition hover:text-stone-900 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
