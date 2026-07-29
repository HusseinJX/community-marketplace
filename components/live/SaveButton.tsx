"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useLogin } from "@/components/auth/ClerkAuthProvider";

// Heart toggle for a broadcast. Signed-out users get a sign-in modal instead.
export function SaveButton({
  broadcastId,
  initialSaved,
  initialCount,
}: {
  broadcastId: string;
  initialSaved: boolean;
  initialCount: number;
}) {
  const { isSignedIn } = useAuth();
  const openLogin = useLogin();
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const inner = (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition " +
        (saved
          ? "bg-rose-100 text-rose-700"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200")
      }
    >
      <Heart className={"h-3.5 w-3.5 " + (saved ? "fill-rose-600 text-rose-600" : "")} />
      {count > 0 ? count : "Save"}
    </span>
  );

  if (!isSignedIn) {
    return (
      <button type="button" aria-label="Save (sign in)" onClick={() => openLogin()}>
        {inner}
      </button>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    // Optimistic.
    setSaved(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch("/api/broadcasts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId, action: next ? "save" : "unsave" }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      // Roll back.
      setSaved(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={saved ? "Unsave" : "Save"}>
      {inner}
    </button>
  );
}
