"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Users, Send, X, CalendarPlus, Plus, ChevronLeft, Lock } from "lucide-react";
import { MatchFinder } from "@/components/match/MatchFinder";
import { DemoCollabProgression } from "@/components/vendor/DemoCollabProgression";
import type { MatchCandidate } from "@/lib/types";
import type { CollabInvite, CollabRoom, CollabMessage, RoomMember, CollaborationSummary } from "@/lib/collab-network";
import { track } from "@/lib/track";

// ── The collaboration surface ────────────────────────────────────────────────
//
// ONE model, deliberately: a collaboration has a NAME, the PEOPLE in it, ONE
// THREAD, and maybe an EVENT. That's it.
//
// What this replaced (and why): the previous version exposed the storage model
// to the user — "occasions" vs rooms, a group chat that could coexist with
// separate 1:1 chats with the same people, an "Add to group chat" button that
// appeared in some states, Owner/Joined badges, role pills, a separate Invites
// tab, and a Create-event button gated by different rules for 1:1 vs group. All
// true to the schema, none of it something a bakery owner should have to hold in
// their head. The schema still does all that underneath; the UI just tells one
// story.
//
// Rules kept, because they carry meaning:
//   · Only the person who started it can invite + create the event (Pro).
//   · "I'm in 👍" is real consent — only people who are in join the event lineup.
//   · Free previews the surface with demo content; the network needs Basic.

type Tier = "free" | "member" | "pro";

// ── Demo content (Free preview + the admin demo) ─────────────────────────────
const DEMO_INVITES = (memberId: string): CollabInvite[] => [
  {
    id: "demo-inv-1", from_id: "demo-cafe", from_name: "Nokku Coffee", to_id: memberId, to_name: "You",
    message: "Want to co-host a weekend pop-up?", status: "pending", room_id: null,
    scope_type: "collab", scope_id: null, role: "vendor", occasion_id: "demo-occ-a",
    occasion_label: "Weekend pop-up", created_at: "2026-06-28T15:00:00.000Z",
  },
];

const DEMO_COLLABS: CollaborationSummary[] = [
  {
    occasion_id: "demo-occ-4", label: "Neighborhood Night Market", roomId: "demo-room-4", eventId: null,
    owned: true, acceptedCount: 3,
    members: [
      { invite_id: "demo-m-1", to_id: "demo-muralist", to_name: "Dani Cruz", status: "accepted", role: "artist" },
      { invite_id: "demo-m-2", to_id: "demo-cantina", to_name: "El Tri Cantina", status: "accepted", role: "food" },
      { invite_id: "demo-m-3", to_id: "demo-greenhouse", to_name: "Greenhouse Project", status: "pending", role: "partner" },
    ],
  },
];

const DEMO_ROOM = (memberId: string): CollabRoom => ({
  id: "demo-room-4", member_a: memberId, member_a_name: "You", member_b: "demo-muralist",
  member_b_name: "Dani Cruz", is_group: true, title: "Neighborhood Night Market", owner_id: memberId,
  occasion_id: "demo-occ-4", occasion_label: "Neighborhood Night Market", event_id: null,
  created_at: "2026-06-24T15:00:00.000Z",
});

const DEMO_MESSAGES = [
  { mine: true, name: "You", text: "Thinking a night market on Valencia — food, art, live music." },
  { mine: false, name: "Dani Cruz", text: "I'm in! I'll do a live mural wall." },
  { mine: false, name: "El Tri Cantina", text: "We'll run a taco + agua fresca stand 🌮" },
];

export function NetworkManager({
  memberId,
  isAdmin,
  demo = false,
  adminDemo = false,
  plan,
}: {
  memberId: string;
  isAdmin: boolean;
  demo?: boolean;
  adminDemo?: boolean;
  plan?: Tier;
}) {
  const preview = demo || adminDemo; // no real backend → seed demo data, keep writes inert
  const canOwn = (plan ?? "pro") === "pro"; // starting + inviting + creating events

  const [collabs, setCollabs] = useState<CollaborationSummary[]>([]);
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [invites, setInvites] = useState<CollabInvite[]>([]);
  const [openId, setOpenId] = useState<string | null>(null); // occasion_id
  const [inviteTo, setInviteTo] = useState<{ id: string; label: string } | null | undefined>(undefined);
  //  undefined = modal closed · null = new collaboration · {…} = add to this one

  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const load = useMemo(
    () => () => {
      if (preview) {
        setCollabs(DEMO_COLLABS);
        setRooms([DEMO_ROOM(memberId)]);
        setInvites(DEMO_INVITES(memberId));
        return;
      }
      fetch(`/api/vendor/collaborations${qp}`)
        .then((r) => (r.ok ? r.json() : { collaborations: [] }))
        .then((d) => setCollabs(Array.isArray(d.collaborations) ? d.collaborations : []))
        .catch(() => {});
      fetch(`/api/vendor/rooms${qp}`)
        .then((r) => (r.ok ? r.json() : { rooms: [] }))
        .then((d) => setRooms(Array.isArray(d.rooms) ? d.rooms : []))
        .catch(() => {});
      fetch(`/api/vendor/invites${qp}`)
        .then((r) => (r.ok ? r.json() : { incoming: [] }))
        .then((d) => setInvites(Array.isArray(d.incoming) ? d.incoming : []))
        .catch(() => {});
    },
    [qp, preview, memberId],
  );

  useEffect(load, [load]);

  const pending = invites.filter((i) => i.status === "pending");
  const open = collabs.find((c) => c.occasion_id === openId) ?? null;

  // One collaboration → one thread. Prefer its shared room; fall back to any
  // room carrying the same occasion (older 1:1-shaped collabs).
  const roomFor = (c: CollaborationSummary): CollabRoom | null =>
    rooms.find((r) => r.id === c.roomId) ?? rooms.find((r) => r.occasion_id === c.occasion_id) ?? null;

  async function respond(id: string, status: "accepted" | "declined") {
    if (preview) return;
    await fetch(`/api/vendor/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    if (status === "accepted") track("collab_invite_accepted", { inviteId: id });
    load();
  }

  // ── Thread view ───────────────────────────────────────────────────────────
  if (open) {
    const room = roomFor(open);
    return (
      <div className="space-y-3">
        <button
          onClick={() => setOpenId(null)}
          className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ChevronLeft className="h-4 w-4" /> Collaborations
        </button>

        {room ? (
          <Thread
            key={room.id}
            room={room}
            collab={open}
            memberId={memberId}
            isAdmin={isAdmin}
            canOwn={canOwn}
            preview={preview}
            onAddPeople={() => setInviteTo({ id: open.occasion_id, label: open.label })}
            onChanged={load}
          />
        ) : (
          <div className="card-soft p-4 text-sm text-stone-500">
            No one has accepted yet — the thread opens when someone joins.
          </div>
        )}

        {inviteTo !== undefined && (
          <InviteModal
            memberId={memberId}
            isAdmin={isAdmin}
            preview={preview}
            target={inviteTo}
            existingCount={collabs.length}
            onClose={() => setInviteTo(undefined)}
            onDone={load}
          />
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Admin/Free demo: watch the lifecycle play out before the static list. */}
      {preview && <DemoCollabProgression />}

      {demo && (
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-600">
          <Lock className="mr-1.5 inline h-3.5 w-3.5 text-stone-400" />
          A preview — you&apos;re not in the network yet.{" "}
          <Link href="/vendor/billing" className="font-semibold text-stone-900 underline">
            Upgrade to join
          </Link>
          .
        </p>
      )}

      {/* Invites — inline, where you'll see them. Not a separate tab. */}
      {pending.map((i) => (
        <div key={i.id} className="card-soft flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-stone-900">
              {i.from_name || "A local business"} invited you
            </span>
            <span className="mt-0.5 block truncate text-xs text-stone-500">
              {i.occasion_label || i.message || "Collaboration"}
            </span>
          </span>
          <button
            onClick={() => respond(i.id, "declined")}
            disabled={preview}
            className="shrink-0 rounded-full px-3 py-2 text-[13px] font-medium text-stone-500 hover:text-stone-800 disabled:opacity-40"
          >
            Decline
          </button>
          <button
            onClick={() => respond(i.id, "accepted")}
            disabled={preview}
            className="shrink-0 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
          >
            Join
          </button>
        </div>
      ))}

      {canOwn && (
        <button
          onClick={() => setInviteTo(null)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3 py-2.5 text-[13px] font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900"
        >
          <Plus className="h-4 w-4" /> New collaboration
        </button>
      )}

      {collabs.length === 0 && pending.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-400">
          {canOwn ? "Nothing yet — start one above." : "Nothing yet. Collaborations you join show up here."}
        </p>
      )}

      {collabs.map((c) => {
        const people = c.members.filter((m) => m.status === "accepted").length + 1; // + you
        return (
          <button
            key={c.occasion_id}
            onClick={() => setOpenId(c.occasion_id)}
            className="card-soft card-hover flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
              <Users className="h-4 w-4 text-stone-500" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-stone-900">{c.label}</span>
              <span className="mt-0.5 block truncate text-xs text-stone-500">
                {people} {people === 1 ? "business" : "businesses"}
              </span>
            </span>
            {c.eventId && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <CalendarPlus className="h-3 w-3" /> Event
              </span>
            )}
          </button>
        );
      })}

      {inviteTo !== undefined && (
        <InviteModal
          memberId={memberId}
          isAdmin={isAdmin}
          preview={preview}
          target={inviteTo}
          existingCount={collabs.length}
          onClose={() => setInviteTo(undefined)}
          onDone={load}
        />
      )}
    </div>
  );
}

// ── One collaboration: who's in, the thread, and the event ───────────────────
function Thread({
  room,
  collab,
  memberId,
  isAdmin,
  canOwn,
  preview,
  onAddPeople,
  onChanged,
}: {
  room: CollabRoom;
  collab: CollaborationSummary;
  memberId: string;
  isAdmin: boolean;
  canOwn: boolean;
  preview: boolean;
  onAddPeople: () => void;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [people, setPeople] = useState<RoomMember[]>([]);
  const [text, setText] = useState("");
  const [planning, setPlanning] = useState(false);
  const [form, setForm] = useState({ title: collab.label, event_date: "", event_time: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState<string | null>(collab.eventId);
  const [demoMsgs, setDemoMsgs] = useState(DEMO_MESSAGES);
  const listRef = useRef<HTMLDivElement>(null);
  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const load = useMemo(
    () => () => {
      if (preview) return;
      fetch(`/api/vendor/rooms/${room.id}${qp}`)
        .then((r) => (r.ok ? r.json() : { messages: [] }))
        .then((d) => setMessages(Array.isArray(d.messages) ? d.messages : []))
        .catch(() => {});
      fetch(`/api/vendor/rooms/${room.id}/members${qp}`)
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((d) => setPeople(Array.isArray(d.members) ? d.members : []))
        .catch(() => {});
    },
    [room.id, qp, preview],
  );

  useEffect(() => {
    load();
    if (preview) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, preview]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, demoMsgs]);

  const iStartedIt = (room.owner_id ?? room.member_a) === memberId;
  const meIn = people.find((p) => p.member_id === memberId)?.agreed ?? false;
  const othersIn = people.filter((p) => p.member_id !== memberId && p.agreed).length;
  // ONE rule, for every collaboration: you started it, and at least one other
  // person is in. (Before: different thresholds for 1:1 vs group.)
  const canCreateEvent = canOwn && iStartedIt && !eventId && othersIn >= 1;

  async function toggleIn() {
    if (preview) return;
    setPeople((ps) => ps.map((p) => (p.member_id === memberId ? { ...p, agreed: !meIn } : p)));
    await fetch(`/api/vendor/rooms/${room.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: !meIn, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    track("collab_agreed", { roomId: room.id, agreed: !meIn });
    load();
  }

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    if (preview) {
      setDemoMsgs((m) => [...m, { mine: true, name: "You", text: t }]);
      return;
    }
    await fetch(`/api/vendor/rooms/${room.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    load();
  }

  async function createEvent() {
    if (!form.title.trim() || preview) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vendor/rooms/${room.id}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setEventId(d.eventId);
        setPlanning(false);
        // The payoff step: a collaboration became a real event.
        track("collab_event_created", { roomId: room.id, eventId: d.eventId, people: people.length });
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  const shown = preview
    ? demoMsgs
    : messages.map((m) => ({ mine: m.sender_id === memberId, name: m.sender_name || "Them", text: m.text }));

  const roster = preview
    ? [{ name: "You", agreed: true }, { name: "Dani Cruz", agreed: true }, { name: "El Tri Cantina", agreed: true }]
    : people.map((p) => ({ name: p.member_id === memberId ? "You" : p.member_name || "Member", agreed: p.agreed }));

  return (
    <div className="card-soft flex h-[70vh] flex-col md:h-[520px]">
      {/* Header — name, and the event (or the button that makes one) */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <p className="min-w-0 truncate text-sm font-semibold text-stone-900">{collab.label}</p>
        <div className="flex shrink-0 items-center gap-2">
          {canOwn && iStartedIt && (
            <button
              onClick={onAddPeople}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-stone-600 hover:text-stone-900"
            >
              Add people
            </button>
          )}
          {eventId ? (
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Event
            </Link>
          ) : (
            canOwn &&
            iStartedIt && (
              <button
                onClick={() => setPlanning((p) => !p)}
                disabled={!canCreateEvent}
                title={canCreateEvent ? undefined : "Someone else needs to be in first"}
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Create event
              </button>
            )
          )}
        </div>
      </div>

      {/* Who's in — consent, in one line */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-4 py-2">
        {roster.map((p) => (
          <span
            key={p.name}
            className={`rounded-full px-2 py-0.5 text-xs ${
              p.agreed ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
            }`}
          >
            {p.agreed ? "👍 " : "· "}
            {p.name}
          </span>
        ))}
        <button
          onClick={toggleIn}
          className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
            meIn ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-stone-300 text-stone-700 hover:bg-stone-50"
          }`}
        >
          {meIn ? "✓ You're in" : "I'm in 👍"}
        </button>
      </div>

      {planning && (
        <div className="space-y-2 border-b border-stone-100 bg-stone-50 p-3">
          <p className="text-xs text-stone-500">Everyone who&apos;s in (👍) joins the lineup.</p>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              placeholder="Date"
              className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Location"
              className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={createEvent}
            disabled={busy || !form.title.trim()}
            className="rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create event"}
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {shown.length === 0 && <p className="text-sm text-stone-400">Say hello 👋</p>}
        {shown.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] break-words rounded-2xl px-3 py-1.5 text-sm ${
                m.mine ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-800"
              }`}
            >
              {!m.mine && <p className="text-[10px] font-medium opacity-70">{m.name}</p>}
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-stone-100 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 rounded-full border border-stone-200 px-3.5 py-2 text-sm focus:border-stone-400 focus:outline-none"
        />
        <button onClick={send} className="rounded-full bg-stone-900 p-2 text-white hover:bg-stone-800">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Invite: pick people, name it if it's new, send ───────────────────────────
function InviteModal({
  memberId,
  isAdmin,
  preview,
  target,
  existingCount,
  onClose,
  onDone,
}: {
  memberId: string;
  isAdmin: boolean;
  preview: boolean;
  target: { id: string; label: string } | null; // null = new collaboration
  // How many collaborations this member already had. On a NEW collaboration this
  // rides along as `collaborations_before` — >= 1 means this is a SECOND one,
  // which is the number the whole thesis turns on.
  existingCount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const excludeIds = useMemo(() => new Set([memberId]), [memberId]);

  const label = target?.label ?? name.trim();
  const ready = picked.size > 0 && !!label;

  function toggle(c: MatchCandidate) {
    setPicked((s) => {
      const n = new Map(s);
      if (n.has(c.id)) n.delete(c.id);
      else n.set(c.id, c);
      return n;
    });
  }

  async function send() {
    if (!ready || preview) return onClose();
    setBusy(true);
    try {
      await fetch("/api/vendor/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: label,
          invitees: [...picked.values()].map((c) => ({ id: c.id, name: c.name })),
          role: "vendor",
          occasionId:
            target?.id ??
            (typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `occ-${Math.round(performance.now())}`),
          occasionLabel: label,
          memberId: isAdmin ? memberId : undefined,
        }),
      });
      track("collab_invite_sent", { count: picked.size, source: target ? "add_to_collab" : "new_collab" });
      if (!target) {
        track("collab_started", { collaborations_before: existingCount, invited: picked.size });
      }
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <p className="text-sm font-semibold text-stone-900">
            {target ? `Add to ${target.label}` : "New collaboration"}
          </p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {!target && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What is it? (e.g. Summer block party)"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          )}
          <MatchFinder
            memberId={memberId}
            isAdmin={isAdmin}
            selected={new Set(picked.keys())}
            onToggle={toggle}
            excludeIds={excludeIds}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-stone-100 p-4">
          <span className="min-w-0 flex-1 truncate text-[13px] text-stone-600">
            {picked.size > 0 ? [...picked.values()].map((c) => c.name).join(", ") : "Pick who you want in."}
          </span>
          <button
            onClick={send}
            disabled={!ready || busy}
            className="shrink-0 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
          >
            {busy ? "Inviting…" : picked.size ? `Invite ${picked.size}` : "Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Keep the old export name working (it's imported as a named export elsewhere).
export default NetworkManager;
