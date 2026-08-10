"use client";

import { useEffect, useState } from "react";
import { Megaphone, Send, Users, UserPlus, Search } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { EventMessage } from "@/lib/event-comms";
import type { CollabInvite } from "@/lib/collab-network";
import type { Member } from "@/lib/types";
import { listMembers } from "@/lib/api";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import { roleDef } from "@/lib/lineup-roles";

// The event update thread: an in-app log + an optional SMS/email blast to the
// accepted lineup. Shared by /vendor/organize and the per-event manager.
// With `showSquad`, the collaborators (lineup) are listed below the composer.
export function EventThread({
  event,
  memberId,
  isAdmin,
  emailReady,
  audienceLabel = "lineup",
  showSquad = false,
  demo = false,
}: {
  event: VendorEvent;
  memberId: string;
  isAdmin: boolean;
  emailReady: boolean;
  audienceLabel?: string;
  showSquad?: boolean;
  demo?: boolean;
}) {
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [squad, setSquad] = useState<CollabInvite[]>([]);
  const [text, setText] = useState("");
  const [sms, setSms] = useState(false);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Invite more" to the squad/lineup
  const [inviting, setInviting] = useState(false);
  const [pool, setPool] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [invitedNow, setInvitedNow] = useState<Set<string>>(new Set());
  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const load = () => {
    if (demo) {
      setMessages([
        { id: "demo-msg-1", event_id: event.id, sender_id: "", sender_name: "You", text: "Lineup's set! Load-in is 4pm, booths face the plaza.", channel: "chat", recipients: null, created_at: "2026-06-24T15:00:00.000Z" },
        { id: "demo-msg-2", event_id: event.id, sender_id: "", sender_name: "Nokku Coffee", text: "We'll bring the cold brew cart 🙌", channel: "chat", recipients: null, created_at: "2026-06-24T15:05:00.000Z" },
        { id: "demo-msg-3", event_id: event.id, sender_id: "", sender_name: "You", text: "Reminder blast sent to the lineup.", channel: "sms", recipients: 4, created_at: "2026-06-24T15:10:00.000Z" },
      ]);
      return;
    }
    fetch(`/api/vendor/events/${event.id}/messages${qp}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => {});
  };
  useEffect(() => {
    load();
    if (demo) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const loadSquad = () => {
    fetch(`/api/vendor/events/${event.id}/lineup${qp}`)
      .then((r) => (r.ok ? r.json() : { lineup: [] }))
      .then((d) => setSquad(Array.isArray(d.lineup) ? d.lineup : []))
      .catch(() => {});
  };
  useEffect(() => {
    if (showSquad) loadSquad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, showSquad]);

  useEffect(() => {
    if (!inviting || pool.length) return;
    listMembers({ limit: 100 })
      .then((r) => setPool(r.members?.length ? r.members : DEMO_MEMBERS))
      .catch(() => setPool(DEMO_MEMBERS));
  }, [inviting, pool.length]);

  const squadIds = new Set(squad.map((s) => s.to_id));
  const inviteResults = pool
    .filter((m) => m.id !== event.member_id && !squadIds.has(m.id))
    .filter((m) => !q.trim() || (m.profile?.name || "").toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 12);

  async function inviteToSquad(m: Member) {
    setInvitedNow((s) => new Set(s).add(m.id));
    await fetch(`/api/vendor/events/${event.id}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitees: [{ id: m.id, name: m.profile?.name, role: "vendor" }], memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    loadSquad();
  }

  async function send() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const channels = ["chat", ...(sms ? ["sms"] : []), ...(email ? ["email"] : [])];
    setText("");
    try {
      await fetch(`/api/vendor/events/${event.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, channels, memberId: isAdmin ? memberId : undefined }),
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-private>
      {/* Chat bubbles, like every other conversation in the app. Blasts render
          as a centred system line — they're a log of what went out, not a turn
          in the conversation. */}
      <div className="space-y-2.5">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">
            No messages yet. Post an update for your {audienceLabel}.
          </p>
        )}
        {messages.map((m) => {
          if (m.channel !== "chat") {
            return (
              <div key={m.id} className="flex justify-center">
                <span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 text-[11px] text-stone-400">
                  <Megaphone className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {m.channel.toUpperCase()} blast to {m.recipients ?? 0} · “{m.text}”
                  </span>
                </span>
              </div>
            );
          }
          const mine = m.sender_id === memberId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  "max-w-[85%] break-words rounded-2xl px-3 py-1.5 text-[13px] leading-snug " +
                  (mine ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800")
                }
              >
                {!mine && (
                  <span className="block text-[10px] font-semibold text-stone-400">{m.sender_name || "Member"}</span>
                )}
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-soft p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message your ${audienceLabel}…`}
          rows={2}
          className="w-full resize-none rounded-lg border border-stone-200 p-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-stone-400">Also send via:</span>
            <label className="flex items-center gap-1 text-stone-600">
              <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="accent-indigo-600" />
              SMS
            </label>
            <label
              className={`flex items-center gap-1 ${emailReady ? "text-stone-600" : "text-stone-300"}`}
              title={emailReady ? "" : "Set RESEND_API_KEY + RESEND_FROM to enable email"}
            >
              <input
                type="checkbox"
                checked={email}
                disabled={!emailReady}
                onChange={(e) => setEmail(e.target.checked)}
                className="accent-indigo-600"
              />
              Email
            </label>
          </div>
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Send
          </button>
        </div>
      </div>

      {/* Your squad — the collaborators on this event (the lineup) */}
      {showSquad && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <Users className="h-3.5 w-3.5 text-indigo-500" /> Your squad ({squad.length})
            </span>
            <button
              onClick={() => setInviting((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <UserPlus className="h-3.5 w-3.5" /> {inviting ? "Done" : "Invite more"}
            </button>
          </div>

          {inviting && (
            <div className="mb-3 rounded-xl border border-stone-200 bg-white p-3">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search the network…"
                  className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {inviteResults.map((m) => {
                  const done = invitedNow.has(m.id);
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                      <span className="min-w-0 truncate text-stone-800">{m.profile?.name || "Member"}</span>
                      <button
                        onClick={() => inviteToSquad(m)}
                        disabled={done}
                        className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
                      >
                        {done ? "Invited" : "Invite"}
                      </button>
                    </div>
                  );
                })}
                {inviteResults.length === 0 && <p className="px-2 py-1 text-xs text-stone-400">No matches.</p>}
              </div>
            </div>
          )}

          {squad.length === 0 ? (
            <p className="text-sm text-stone-400">No collaborators yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
              {squad.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span title={roleDef(s.role || "vendor").label}>{roleDef(s.role || "vendor").emoji}</span>
                    <span className="truncate text-stone-800">{s.to_name || "Collaborator"}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "accepted"
                        ? "bg-emerald-100 text-emerald-700"
                        : s.status === "declined"
                          ? "bg-stone-200 text-stone-500"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
