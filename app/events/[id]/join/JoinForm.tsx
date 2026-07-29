"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Check, Store } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { listMembers } from "@/lib/api";
import type { Member } from "@/lib/types";

type Mode = "find" | "new";

export function JoinForm({ eventId, hostName }: { eventId: string; hostName: string }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [mode, setMode] = useState<Mode>("find");
  const [done, setDone] = useState<null | "join" | "request">(null);

  if (done === "join") {
    return (
      <Success
        title="You're in the queue!"
        body={`Thanks for signing up. ${hostName} will confirm you on the lineup shortly.`}
      />
    );
  }
  if (done === "request") {
    return (
      <Success
        title="Request sent"
        body={`We've shared your details with ${hostName}. They'll reach out to get your business added.`}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
        <button
          onClick={() => setMode("find")}
          className={`flex-1 rounded-md py-1.5 font-medium ${mode === "find" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Find my business
        </button>
        <button
          onClick={() => setMode("new")}
          className={`flex-1 rounded-md py-1.5 font-medium ${mode === "new" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Not listed yet
        </button>
      </div>

      {mode === "find" ? (
        <FindBusiness
          eventId={eventId}
          isSignedIn={!!isSignedIn}
          isLoaded={isLoaded}
          onJoined={() => setDone("join")}
        />
      ) : (
        <NewBusiness eventId={eventId} onSubmitted={() => setDone("request")} />
      )}
    </div>
  );
}

function FindBusiness({
  eventId,
  isSignedIn,
  isLoaded,
  onJoined,
}: {
  eventId: string;
  isSignedIn: boolean;
  isLoaded: boolean;
  onJoined: () => void;
}) {
  const openLogin = useLogin();
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listMembers({ limit: 100 })
      .then((r) => setMembers(r.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members.filter((m) => (m.profile?.name || "").toLowerCase().includes(q)).slice(0, 6);
  }, [query, members]);

  async function join() {
    if (!picked) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/events/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, memberId: picked.id, memberName: picked.profile?.name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      onJoined();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  if (picked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
          <Store className="h-5 w-5 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-stone-900">{picked.profile?.name}</p>
            <p className="truncate text-xs text-stone-500">
              {[picked.profile?.city, picked.profile?.category].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={() => setPicked(null)} className="text-xs text-stone-500 hover:underline">
            Change
          </button>
        </div>

        {isLoaded && !isSignedIn ? (
          <button
            onClick={() => openLogin()}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Sign in to join the lineup
          </button>
        ) : (
          <button
            onClick={join}
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Joining…" : "Join the lineup"}
          </button>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your business name…"
          className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"
        />
      </div>
      {matches.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-lg border border-stone-200">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => setPicked(m)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"
              >
                <span className="font-medium text-stone-900">{m.profile?.name}</span>
                <span className="text-xs text-stone-400">{m.profile?.city}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="mt-2 text-sm text-stone-400">No match — try the &ldquo;Not listed yet&rdquo; tab.</p>
      )}
    </div>
  );
}

function NewBusiness({ eventId, onSubmitted }: { eventId: string; onSubmitted: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim()) {
      setErr("Business name is required.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/events/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, request: { name: name.trim(), category, contact, note } }),
      });
      if (!res.ok) throw new Error("Failed");
      onSubmitted();
    } catch {
      setErr("Couldn't send — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name *" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="What you sell (e.g. produce, baked goods)" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else? (optional)" rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Request to join"}
      </button>
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </div>
  );
}

function Success({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
        <Check className="h-5 w-5 text-white" />
      </div>
      <p className="font-semibold text-stone-900">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
    </div>
  );
}
