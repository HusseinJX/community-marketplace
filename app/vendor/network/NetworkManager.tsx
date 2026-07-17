"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Users, Send, X, CalendarPlus, Plus, ChevronLeft, LogIn } from "lucide-react";
import { CollabComposer } from "@/components/vendor/CollabComposer";
import { loadDemoCollabs, demoRoomIdFor } from "@/lib/demo-collab-store";
import { DemoCollabProgression } from "@/components/vendor/DemoCollabProgression";
import { CollabRoomDemo } from "@/components/vendor/CollabRoomDemo";
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

// Only self-joins ("things you asked to join") live in the pending list. Invites
// you SENT live inside the collaboration you created (see DEMO_COLLABS below).
const DEMO_OUTGOING = (memberId: string): CollabInvite[] => [
  {
    id: "demo-out-2", from_id: memberId, from_name: "You", to_id: memberId, to_name: "You",
    message: null, status: "pending", room_id: null,
    scope_type: "collab", scope_id: null, role: "vendor", occasion_id: "demo-occ-6",
    occasion_label: "Mission Art Walk", created_at: "2026-06-28T16:30:00.000Z",
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
  // A collaboration you just created — you invited Rosa's Flowers, still pending.
  {
    occasion_id: "demo-occ-5", label: "Summer sidewalk sale", roomId: "demo-room-5", eventId: null,
    owned: true, acceptedCount: 0,
    members: [
      { invite_id: "demo-m-4", to_id: "demo-flowers", to_name: "Rosa's Flowers", status: "pending", role: "vendor" },
    ],
  },
];

// One room per demo collaboration. Both must exist: a collab whose room is
// missing can't resolve its unread badge (or be marked read), so its count would
// sit in the tab total forever with no card to clear it.
const DEMO_ROOMS = (memberId: string): CollabRoom[] => [
  {
    id: "demo-room-4", member_a: memberId, member_a_name: "You", member_b: "demo-muralist",
    member_b_name: "Dani Cruz", is_group: true, title: "Neighborhood Night Market", owner_id: memberId,
    occasion_id: "demo-occ-4", occasion_label: "Neighborhood Night Market", event_id: null,
    created_at: "2026-06-24T15:00:00.000Z",
  },
  {
    id: "demo-room-5", member_a: memberId, member_a_name: "You", member_b: "demo-flowers",
    member_b_name: "Rosa's Flowers", is_group: true, title: "Summer sidewalk sale", owner_id: memberId,
    occasion_id: "demo-occ-5", occasion_label: "Summer sidewalk sale", event_id: null,
    created_at: "2026-06-28T16:00:00.000Z",
  },
];

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
  onChatOpenChange,
  unreadByRoom,
  onRoomSeen,
}: {
  memberId: string;
  isAdmin: boolean;
  demo?: boolean;
  adminDemo?: boolean;
  plan?: Tier;
  // Reports whether a collaboration thread is open, so the parent can hide its
  // tab bar for a full-screen chat.
  onChatOpenChange?: (open: boolean) => void;
  // Unread counts keyed by ROOM id (the shell owns read state — see lib/unread).
  unreadByRoom?: Record<string, number>;
  onRoomSeen?: (roomId: string) => void;
}) {
  const preview = demo || adminDemo; // no real backend → seed demo data, keep writes inert
  const canOwn = (plan ?? "pro") !== "free"; // starting + inviting + creating events = Basic+

  const [collabs, setCollabs] = useState<CollaborationSummary[]>([]);
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [invites, setInvites] = useState<CollabInvite[]>([]);
  const [outgoing, setOutgoing] = useState<CollabInvite[]>([]);
  const [openId, setOpenId] = useState<string | null>(null); // occasion_id
  const [inviteTo, setInviteTo] = useState<{ id: string; label: string } | null | undefined>(undefined);
  //  undefined = modal closed · null = new collaboration · {…} = add to this one

  const qp = isAdmin ? `?memberId=${memberId}` : "";

  // Deep link: ?collab=<occasion_id> opens straight into that chat. Set it
  // before the data lands — the thread renders as soon as the collab resolves.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("collab");
    if (id) setOpenId(id);
  }, []);

  // Tell the parent when a thread is open (occasion selected) vs the list view.
  useEffect(() => {
    onChatOpenChange?.(openId != null);
  }, [openId, onChatOpenChange]);

  // Opening a collaboration reads it — stamp its room as seen.
  useEffect(() => {
    if (!openId) return;
    const c = collabs.find((x) => x.occasion_id === openId);
    if (!c) return;
    const room = rooms.find((r) => r.id === c.roomId) ?? rooms.find((r) => r.occasion_id === c.occasion_id);
    if (room) onRoomSeen?.(room.id);
  }, [openId, collabs, rooms, onRoomSeen]);

  const load = useMemo(
    () => () => {
      if (preview) {
        // Anything created during this demo session comes first, so "create it →
        // open its chat" actually lands somewhere real.
        const mine = loadDemoCollabs();
        setCollabs([
          ...mine.map<CollaborationSummary>((c) => ({
            occasion_id: c.occasion_id,
            label: c.label,
            roomId: demoRoomIdFor(c.occasion_id),
            eventId: null,
            owned: true,
            acceptedCount: 0,
            members: c.members.map((m, i) => ({
              invite_id: `${c.occasion_id}-${i}`,
              to_id: m.to_id,
              to_name: m.to_name,
              status: "pending",
              role: m.role,
            })),
          })),
          ...DEMO_COLLABS,
        ]);
        setRooms([
          ...mine.map<CollabRoom>((c) => ({
            id: demoRoomIdFor(c.occasion_id),
            member_a: memberId,
            member_a_name: "You",
            member_b: c.members[0]?.to_id ?? "",
            member_b_name: c.members[0]?.to_name ?? null,
            is_group: true,
            title: c.label,
            owner_id: memberId,
            occasion_id: c.occasion_id,
            occasion_label: c.label,
            event_id: null,
            created_at: c.created_at,
          })),
          ...DEMO_ROOMS(memberId),
        ]);
        setInvites(DEMO_INVITES(memberId));
        setOutgoing(DEMO_OUTGOING(memberId));
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
        .then((r) => (r.ok ? r.json() : { incoming: [], outgoing: [] }))
        .then((d) => {
          setInvites(Array.isArray(d.incoming) ? d.incoming : []);
          setOutgoing(Array.isArray(d.outgoing) ? d.outgoing : []);
        })
        .catch(() => {});
    },
    [qp, preview, memberId],
  );

  useEffect(load, [load]);

  // Pending things you still act on:
  //  · received — someone invited YOU (from someone else)
  //  · joinRequests — YOU asked to join something (self-join: from_id === to_id)
  // Invites you SENT are NOT here — they live inside the collaboration you
  // created (it shows in Collaborations with those people as pending members).
  const pending = invites.filter((i) => i.status === "pending" && i.from_id !== memberId);
  const joinRequests = outgoing.filter((i) => i.status === "pending" && i.to_id === memberId);
  const open = collabs.find((c) => c.occasion_id === openId) ?? null;

  // One collaboration → one thread. Prefer its shared room; fall back to any
  // room carrying the same occasion (older 1:1-shaped collabs).
  const roomFor = (c: CollaborationSummary): CollabRoom | null =>
    rooms.find((r) => r.id === c.roomId) ?? rooms.find((r) => r.occasion_id === c.occasion_id) ?? null;

  async function respond(id: string, status: "accepted" | "declined") {
    const inv = invites.find((i) => i.id === id);

    // Demo: no backend. Accepting an invite opens a collaboration chat — so
    // simulate it locally: drop it from pending, add a collaboration for it, and
    // open its thread (the interactive CollabRoomDemo).
    if (preview) {
      setInvites((arr) => arr.filter((i) => i.id !== id));
      if (status === "accepted" && inv) {
        const occId = inv.occasion_id || inv.id;
        const label = inv.occasion_label || inv.message || "Collaboration";
        setCollabs((cs) =>
          cs.some((c) => c.occasion_id === occId)
            ? cs
            : [
                {
                  occasion_id: occId,
                  label,
                  roomId: `demo-room-${occId}`,
                  eventId: null,
                  owned: false,
                  acceptedCount: 2,
                  members: [
                    { invite_id: `${id}-a`, to_id: inv.from_id, to_name: inv.from_name, status: "accepted", role: inv.role },
                    { invite_id: `${id}-b`, to_id: memberId, to_name: "You", status: "accepted", role: inv.role },
                  ],
                },
                ...cs,
              ],
        );
        setOpenId(occId);
      }
      return;
    }

    await fetch(`/api/vendor/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    if (status === "accepted") {
      track("collab_invite_accepted", { inviteId: id });
      // Accepting opens the collaboration chat — jump into its thread.
      if (inv?.occasion_id) setOpenId(inv.occasion_id);
    }
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

        {preview ? (
          // The interactive Chat + Plan + AI-coordinator demo (local state only).
          // If YOU own it you're the lead; if you JOINED it, the lead is whoever
          // invited you (the first non-"You" member) and you get an "I'm in".
          <CollabRoomDemo
            collab={open}
            owned={open.owned}
            leadName={
              open.owned
                ? "You"
                : open.members.find((m) => m.to_name && m.to_name !== "You")?.to_name ?? "the organizer"
            }
          />
        ) : room ? (
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
      {/* Admin demo: watch the lifecycle play out before the static list. */}
      {preview && <DemoCollabProgression />}

      {/* ── Pending: invites you received + things you asked to join — grouped
             so they're clearly separate from your active collaborations below.
             (Invites you sent live inside the collaboration you created.) */}
      {(pending.length > 0 || joinRequests.length > 0) && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Pending
          </p>

          {/* Received — you can Join or Decline. */}
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
                className="shrink-0 rounded-full px-3 py-2 text-[13px] font-medium text-stone-500 hover:text-stone-800"
              >
                Decline
              </button>
              <button
                onClick={() => respond(i.id, "accepted")}
                className="shrink-0 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800"
              >
                Join
              </button>
            </div>
          ))}

          {/* Asked to join — you requested to join; waiting on the host's approval. */}
          {joinRequests.map((i) => (
            <div key={i.id} className="card-soft flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
                <LogIn className="h-4 w-4 text-stone-500" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-stone-900">
                  You asked to join {i.occasion_label || i.message || "a collaboration"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-stone-500">
                  Waiting on the host&apos;s approval
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                Pending
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Collaborations: the ones you're in, plus starting a new one. */}
      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          Collaborations
        </p>

        {canOwn && (
          // Opens the New collaboration PAGE — the same composer as the dashboard.
          <Link
            href={isAdmin ? `/vendor/collab/new?memberId=${memberId}` : "/vendor/collab/new"}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3 py-2.5 text-[13px] font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900"
          >
            <Plus className="h-4 w-4" /> New collaboration
          </Link>
        )}

        {collabs.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            {canOwn ? "Nothing yet — start one above." : "Nothing yet. Collaborations you join show up here."}
          </p>
        ) : (
          collabs.map((c) => {
            const people = c.members.filter((m) => m.status === "accepted").length + 1; // + you
            const invited = c.members.filter((m) => m.status === "pending").length; // awaiting reply
            const unread = unreadByRoom?.[roomFor(c)?.id ?? ""] ?? 0;
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
                    {invited > 0 && ` · ${invited} invited`}
                  </span>
                </span>
                {unread > 0 && (
                  <span
                    aria-label={`${unread} unread`}
                    className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold tabular-nums text-white"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                {c.eventId && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <CalendarPlus className="h-3 w-3" /> Event
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

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

// ── Invite modal — the SAME composer as the dashboard "Create" card. ─────────
// New collaboration → title + description + For-you/Search people picker.
// Add-to-existing (target set) → just the people picker under the fixed name.
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

        <div className="overflow-y-auto p-4">
          <CollabComposer
            memberId={memberId}
            isAdmin={isAdmin}
            demo={preview}
            existing={target ? { occasionId: target.id, label: target.label } : undefined}
            source={target ? "network_add" : "network"}
            collaborationsBefore={existingCount}
            onDone={() => {
              onDone();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Keep the old export name working (it's imported as a named export elsewhere).
export default NetworkManager;
