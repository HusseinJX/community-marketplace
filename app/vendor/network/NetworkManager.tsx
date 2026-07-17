"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Users, Send, X, CalendarPlus, Plus, ChevronLeft, LogIn, MessageSquare, Calendar, Ticket } from "lucide-react";
import { CollabComposer } from "@/components/vendor/CollabComposer";
import { CollabEventTab } from "@/components/vendor/CollabEventTab";
import { EventAttendees } from "@/components/organize/EventAttendees";
import type { VendorEvent } from "@/lib/vendor-connect";
import { loadDemoCollabs, demoRoomIdFor } from "@/lib/demo-collab-store";
import { demoCollaborations, demoRooms } from "@/lib/demo-collab";
import { DemoCollabProgression } from "@/components/vendor/DemoCollabProgression";
import { CollabRoomDemo } from "@/components/vendor/CollabRoomDemo";
import type { CollabInvite, CollabRoom, CollabMessage, RoomMemberView, CollaborationSummary } from "@/lib/collab-network";
import { collabEventDay, collabStatus, compareCollabs, STATUS_CLASS } from "@/lib/collab-status";
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

// The demo's collaborations come from lib/demo-collab — the SAME fixtures the
// API serves (/api/vendor/collaborations returns them for a demo actor), which
// is what the dashboard's Upcoming collabs rail reads.
//
// They used to be a second, local set with different occasion ids (demo-occ-4 vs
// demo-occasion-market). That meant the demo's home and Messages listed entirely
// different collaborations, and — worse — deep-linking from a home card
// (?collab=demo-occasion-market) matched nothing here, so it silently fell back
// to the list. Clicking a collaboration appeared to "just open Messages".
// One source of truth, and the link lands.

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
  // Active = what you're in; Pending = what wants an answer from you. Active
  // leads: your commitments matter more than a stranger's unanswered invite.
  const [listTab, setListTab] = useState<"active" | "pending">("active");
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
            eventDate: null,
            eventTime: null,
            eventLocation: null,
            owned: true,
            acceptedCount: 0,
            // You started it, so you're in; nobody's replied yet.
            myAgreed: true,
            agreedCount: 1,
            memberCount: 1,
            members: c.members.map((m, i) => ({
              invite_id: `${c.occasion_id}-${i}`,
              to_id: m.to_id,
              to_name: m.to_name,
              status: "pending",
              role: m.role,
            })),
          })),
          ...demoCollaborations(memberId),
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
          ...demoRooms(memberId),
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
                  eventDate: null,
                  eventTime: null,
                  eventLocation: null,
                  owned: false,
                  acceptedCount: 2,
                  // Accepting put you in the room — "I'm in 👍" is still owed,
                  // so this shows as "Confirm you're in".
                  myAgreed: false,
                  agreedCount: 1,
                  memberCount: 2,
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
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <button
          onClick={() => setOpenId(null)}
          className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-stone-600 hover:text-stone-900"
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
  const pendingCount = pending.length + joinRequests.length

  return (
    <div className="space-y-4">
      {/* Admin demo: watch the lifecycle play out before the static list. */}
      {preview && <DemoCollabProgression />}

      {/* ── Active | Pending. These used to be two sections stacked on one page,
             which meant your real collaborations got pushed below a pile of
             invites you hadn't answered. They're different jobs — "what am I in"
             vs "what wants an answer from me" — so they're tabs, and Active leads. */}
      <div className="inline-flex rounded-full bg-stone-100 p-0.5 text-[12px] font-medium">
        {(['active', 'pending'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setListTab(t)}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 capitalize transition ' +
              (listTab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
            }
          >
            {t}
            {t === 'pending' && pendingCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold tabular-nums text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {listTab === 'pending' && (
        <div className="space-y-2">
          {pendingCount === 0 && (
            <p className="py-8 text-center text-sm text-stone-400">Nothing waiting on you.</p>
          )}

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

      {/* ── Active: the ones you're in, plus starting a new one. */}
      {listTab === 'active' && (
      <div className="space-y-2">
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
          // Soonest first, then Active above Planning — the same order the
          // dashboard's Active collabs card uses (see compareCollabs).
          [...collabs].sort(compareCollabs).map((c) => {
            const unread = unreadByRoom?.[roomFor(c)?.id ?? ""] ?? 0;
            const status = collabStatus(c);
            return (
              // The WHOLE card opens the collaboration — a stretched button over
              // the card, rather than a button around the title. Having to hit
              // the words is a miss waiting to happen on a phone. The event chip
              // is the one exception, and sits above it (z-20).
              <div key={c.occasion_id} className="card-soft card-hover relative w-full p-4">
                <button
                  onClick={() => setOpenId(c.occasion_id)}
                  aria-label={`Open ${c.label}`}
                  className="absolute inset-0 z-10 rounded-2xl"
                />

                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
                    <Users className="h-4 w-4 text-stone-500" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-900">{c.label}</span>
                    {/* The state sits where the roster line used to — same card as
                        the dashboard's Upcoming tab, so the two can't drift. */}
                    <span className="mt-1 flex">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status.key]}`}
                      >
                        {status.label}
                      </span>
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

                  {/* Straight to the public event page — no need to open the chat.
                      The date sits under the chip, same as the dashboard card. */}
                  {c.eventId && (
                    <span className="flex shrink-0 flex-col items-center gap-0.5">
                      <Link
                        href={`/events/${c.eventId}`}
                        title="Go to the event page"
                        className="relative z-20 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <CalendarPlus className="h-3 w-3" /> Event
                      </Link>
                      {collabEventDay(c) && (
                        <span className="text-[10px] font-medium tabular-nums text-stone-400">
                          {collabEventDay(c)}
                        </span>
                      )}
                    </span>
                  )}
                </div>

              </div>
            );
          })
        )}
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

// ── Roster once the lineup is locked ─────────────────────────────────────────
// Splits the room into the committed lineup and anyone asking to get on now.
// The host can approve/decline the askers right here (same action as Organize →
// Lineup), so a request doesn't have to bounce them to another screen.
function LockedRoster({
  people,
  me,
  isHost,
  onApprove,
  onDecline,
}: {
  people: RoomMemberView[];
  me: string;
  isHost: boolean;
  onApprove: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
}) {
  const onLineup = people.filter((p) => p.lineup === "accepted");
  const asking = people.filter((p) => p.lineup === "pending");
  const nameOf = (p: RoomMemberView) => (p.member_id === me ? "You" : p.member_name || "Member");

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          On the lineup · {onLineup.length}
        </p>
        <div className="space-y-1.5">
          {onLineup.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm"
            >
              <span className="text-stone-800">{nameOf(p)}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Locked in
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Only rendered when someone's actually asking — no empty "requests" box. */}
      {asking.length > 0 && (
        <section>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
            Asking to join · {asking.length}
          </p>
          <div className="space-y-1.5">
            {asking.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm"
              >
                <span className="text-stone-800">
                  {nameOf(p)} <span className="text-xs text-amber-600">wants on the lineup</span>
                </span>
                {isHost && p.lineupInviteId ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      onClick={() => onApprove(p.lineupInviteId!)}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => onDecline(p.lineupInviteId!)}
                      className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Not now
                    </button>
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Waiting on the host
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
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
  const [people, setPeople] = useState<RoomMemberView[]>([]);
  const [text, setText] = useState("");
  const [planning, setPlanning] = useState(false);
  const [form, setForm] = useState({ title: collab.label, event_date: "", event_time: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState<string | null>(collab.eventId);
  const [demoMsgs, setDemoMsgs] = useState(DEMO_MESSAGES);
  // Chat by default; Events + Attendees only appear once the event exists.
  const [tab, setTab] = useState<"chat" | "people" | "event" | "attendees">("chat");
  const [event, setEvent] = useState<VendorEvent | null>(null);
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
        .then((d) => {
          setPeople(Array.isArray(d.members) ? d.members : []);
          // The room is the source of truth for whether the event exists — the
          // host may have created it from another device while this is open.
          if (d.eventId) setEventId(d.eventId);
        })
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

  // Load the event once it exists, for the Events + Attendees tabs.
  useEffect(() => {
    if (!eventId || preview) return;
    fetch(`/api/vendor/events/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.event && setEvent(d.event))
      .catch(() => {});
  }, [eventId, preview]);

  // Event/Attendees exist only once the event does. Derive the shown tab rather
  // than correcting state in an effect, so we never park on a vanished pane.
  const activeTab = !eventId && (tab === "event" || tab === "attendees") ? "chat" : tab;

  const iStartedIt = (room.owner_id ?? room.member_a) === memberId;
  const me = people.find((p) => p.member_id === memberId);
  const meIn = me?.agreed ?? false;
  const othersIn = people.filter((p) => p.member_id !== memberId && p.agreed).length;
  // ONE rule, for every collaboration: you started it, and at least one other
  // person is in. (Before: different thresholds for 1:1 vs group.)
  const canCreateEvent = canOwn && iStartedIt && !eventId && othersIn >= 1;

  // Once the event exists the lineup is locked (the server refuses the flip
  // too — see api/vendor/rooms/[id]/members). From then on the question isn't
  // "are you in", it's "are you ON it" — and if you're not, you ask the host.
  const locked = !!eventId;
  const myLineup = me?.lineup ?? null;

  async function toggleIn() {
    if (preview || locked) return;
    setPeople((ps) => ps.map((p) => (p.member_id === memberId ? { ...p, agreed: !meIn } : p)));
    await fetch(`/api/vendor/rooms/${room.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: !meIn, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    track("collab_agreed", { roomId: room.id, agreed: !meIn });
    load();
  }

  // You weren't in when the event was made, and you want in now. This is the
  // SAME pending self-join the public event link creates (from_id === to_id), so
  // it lands in the host's Lineup tab with the Approve/Decline they already use.
  // No new table, no second approval UI, no re-invite round-trip through the host.
  async function requestToJoin() {
    if (!eventId || busy) return;
    setBusy(true);
    try {
      if (preview || eventId.startsWith("demo-")) {
        setPeople((ps) => ps.map((p) => (p.member_id === memberId ? { ...p, lineup: "pending" } : p)));
        track("collab_lineup_requested", { roomId: room.id, eventId, demo: true });
        return;
      }
      const res = await fetch("/api/events/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, memberId, memberName: me?.member_name ?? null }),
      });
      if (res.ok) {
        setPeople((ps) => ps.map((p) => (p.member_id === memberId ? { ...p, lineup: "pending" } : p)));
        track("collab_lineup_requested", { roomId: room.id, eventId });
        load();
      }
    } catch {
      /* leave the button as-is so they can retry */
    } finally {
      setBusy(false);
    }
  }

  // Host approves/declines someone who asked to join AFTER the lineup locked.
  // Reuses the same endpoint the Organize → Lineup tab uses.
  async function decideJoin(inviteId: string, status: "accepted" | "declined") {
    if (preview || !eventId) return;
    setPeople((ps) =>
      ps.map((p) => (p.lineupInviteId === inviteId ? { ...p, lineup: status === "accepted" ? "accepted" : null } : p)),
    );
    await fetch(`/api/vendor/events/${eventId}/lineup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: inviteId, status }),
    }).catch(() => {});
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

  // Before the event: 👍 = said they're in. After it: 👍 = ON the lineup, which
  // is the only sense in which "in" still means anything. Someone who asked to
  // be added shows as waiting, so the room can see the host owes them an answer.
  const roster = preview
    ? [
        { name: "You", in: true, waiting: false },
        { name: "Dani Cruz", in: true, waiting: false },
        { name: "El Tri Cantina", in: true, waiting: false },
      ]
    : people.map((p) => ({
        name: p.member_id === memberId ? "You" : p.member_name || "Member",
        in: locked ? p.lineup === "accepted" : p.agreed,
        waiting: locked && p.lineup === "pending",
      }));

  return (
    // Fills the shell's full-screen box (was a fixed h-[70vh] md:h-[520px], which
    // is why the composer sat mid-screen instead of above the bottom nav).
    <div className="card-soft flex min-h-0 flex-1 flex-col">
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
            // The collaboration made it — this is the thing it became.
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Go to event page
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

      {/* Consent, always visible — the heartbeat of the room. Changes meaning
          the moment the event is real: before, you flip yourself in; after, you
          ask the host. Sits above the tabs so it's reachable from any of them. */}
      <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 py-2">
        <span className="text-xs text-stone-500">
          {locked ? "Event scheduled" : `${roster.filter((p) => p.in).length} in`}
        </span>
        {!locked ? (
          <button
            onClick={toggleIn}
            className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
              meIn ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {meIn ? "✓ You're in" : "I'm in 👍"}
          </button>
        ) : myLineup === "accepted" ? (
          <span
            title="The event is scheduled and you're on the lineup"
            className="ml-auto rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
          >
            ✓ On the lineup
          </span>
        ) : myLineup === "pending" ? (
          <span
            title="The host has your request"
            className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
          >
            🕓 Requested
          </span>
        ) : (
          <button
            onClick={requestToJoin}
            disabled={busy}
            title="The event was created without you — the host can still add you"
            className="ml-auto rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {busy ? "Requesting…" : "Request to join"}
          </button>
        )}
      </div>

      {/* Tabs. Events + Attendees appear only once the event exists — before
          that there's nothing to show or edit. */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-stone-200 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ["chat", "Chat", MessageSquare],
          ["people", "Participants", Users],
          ...(eventId ? ([["event", "Event", Calendar], ["attendees", "Attendees", Ticket]] as const) : []),
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-medium ${
              tab === key ? "border-indigo-500 text-indigo-700" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {planning && activeTab === "chat" && (
        <div className="space-y-2 border-b border-stone-100 bg-stone-50 p-3">
          <p className="text-xs text-stone-500">Everyone who&apos;s in (👍) joins the lineup.</p>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            {/* A real date, not a typed string: this is what both collab lists
                sort on ("what's about to happen"), and a free-text box gave us
                "next saturday", which sorts nowhere. */}
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900"
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

      {/* ── Participants ── */}
      {activeTab === "people" && (
        <div className="flex-1 overflow-y-auto p-4">
          {locked ? (
            // After the event is created the lineup is LOCKED: the roster stops
            // being one "in / not in" list and splits into who's committed vs
            // who's asking to get on now. Same people, different question.
            <LockedRoster
              people={people}
              me={memberId}
              isHost={iStartedIt}
              onApprove={(id) => decideJoin(id, "accepted")}
              onDecline={(id) => decideJoin(id, "declined")}
            />
          ) : (
            <div className="space-y-1.5">
              {roster.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-sm"
                >
                  <span className="text-stone-800">{p.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.in ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {p.in ? "In 👍" : "Not in yet"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Event (the public card, editable by the host) ── */}
      {activeTab === "event" && (
        <div className="flex-1 overflow-y-auto">
          {event ? (
            <CollabEventTab
              event={event}
              hostMemberId={iStartedIt ? memberId : (room.owner_id ?? room.member_a)}
              canEdit={canOwn && iStartedIt}
              onSaved={(e) => setEvent(e)}
            />
          ) : (
            <p className="p-4 text-sm text-stone-400">Loading the event…</p>
          )}
        </div>
      )}

      {/* ── Attendees (RSVPs to the event) ── */}
      {activeTab === "attendees" && (
        <div className="flex-1 overflow-y-auto">
          {event ? (
            <EventAttendees event={event} emailReady={false} />
          ) : (
            <p className="p-4 text-sm text-stone-400">Loading attendees…</p>
          )}
        </div>
      )}

      {/* ── Chat ── */}
      {activeTab === "chat" && (
        <>
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
        </>
      )}
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
