"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users, UserRound, Send, Check, X, CalendarPlus, MapPin, Plus } from "lucide-react";
import { listMembers } from "@/lib/api";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import type { Member, MemberType } from "@/lib/types";
import type { CollabInvite, CollabRoom, CollabMessage, RoomMember, CollaborationSummary } from "@/lib/collab-network";
import { LINEUP_ROLES, roleDef } from "@/lib/lineup-roles";

type Tab = "discover" | "invites" | "rooms";
const TYPE_FILTERS: { key: MemberType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vendor", label: "Vendors" },
  { key: "artist", label: "Artists" },
  { key: "organizer", label: "Community" },
];

export function NetworkManager({
  memberId,
  myCity,
  isAdmin,
}: {
  memberId: string;
  myCity: string;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>("rooms");
  const [incoming, setIncoming] = useState<CollabInvite[]>([]);
  const [outgoing, setOutgoing] = useState<CollabInvite[]>([]);
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [collabs, setCollabs] = useState<CollaborationSummary[]>([]);
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  // Invite modal — `occasion` null = create a new collaboration.
  const [modal, setModal] = useState<{ occasion: { id: string; label: string } | null } | null>(null);
  // Membership tier — Basic can only join collaborations they're invited to.
  const [membership, setMembership] = useState<"basic" | "pro">("basic");
  const canOwn = membership !== "basic";
  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const jumpToRoom = (roomId?: string) => {
    setFocusRoomId(roomId ?? null);
    setTab("rooms");
  };

  const loadInvites = () => {
    fetch(`/api/vendor/invites${qp}`)
      .then((r) => (r.ok ? r.json() : { incoming: [], outgoing: [] }))
      .then((d) => {
        setIncoming(Array.isArray(d.incoming) ? d.incoming : []);
        setOutgoing(Array.isArray(d.outgoing) ? d.outgoing : []);
      })
      .catch(() => {});
  };
  const loadRooms = () => {
    fetch(`/api/vendor/rooms${qp}`)
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((d) => setRooms(Array.isArray(d.rooms) ? d.rooms : []))
      .catch(() => {});
  };
  const loadCollabs = () => {
    fetch(`/api/vendor/collaborations${qp}`)
      .then((r) => (r.ok ? r.json() : { collaborations: [] }))
      .then((d) => setCollabs(Array.isArray(d.collaborations) ? d.collaborations : []))
      .catch(() => {});
  };

  useEffect(() => {
    loadInvites();
    loadRooms();
    loadCollabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp]);

  const pendingIn = incoming.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
            <Users className="h-6 w-6 text-indigo-500" /> Your network
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Find nearby vendors, artists, and community orgs to collaborate with — send an invite, and
            when they accept you get a shared room to plan it.
          </p>
        </div>
        {/* Membership tier — Basic can only join collaborations they're invited to. */}
        <div className="inline-flex shrink-0 rounded-lg border border-stone-200 p-0.5 text-xs font-medium">
          {(["basic", "pro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMembership(m)}
              className={`rounded-md px-2.5 py-1 capitalize ${
                membership === m ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {!canOwn && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          On <strong>Basic</strong> you can join collaborations you&apos;re invited to. Upgrade to <strong>Pro</strong> to start your own.
        </p>
      )}

      <div className="flex gap-1 border-b border-stone-200">
        {([
          ["rooms", `Collaborations${collabs.length ? ` (${collabs.length})` : ""}`],
          ["invites", `Invites${pendingIn ? ` (${pendingIn})` : ""}`],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k
                ? "border-indigo-500 text-indigo-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "invites" && (
        <Invites
          memberId={memberId}
          isAdmin={isAdmin}
          incoming={incoming}
          onChange={() => {
            loadInvites();
            loadRooms();
            loadCollabs();
          }}
          openRoom={jumpToRoom}
        />
      )}
      {tab === "rooms" && (
        <Rooms
          memberId={memberId}
          isAdmin={isAdmin}
          rooms={rooms}
          collabs={collabs}
          focusRoomId={focusRoomId}
          canOwn={canOwn}
          onInvite={(occ) => setModal({ occasion: occ })}
          onNew={() => setModal({ occasion: null })}
        />
      )}

      {modal && (
        <InviteModal
          memberId={memberId}
          myCity={myCity}
          isAdmin={isAdmin}
          outgoing={outgoing}
          occasion={modal.occasion}
          onClose={() => setModal(null)}
          onInvited={() => {
            loadInvites();
            loadRooms();
            loadCollabs();
          }}
        />
      )}
    </div>
  );
}

// Invite modal — the network search/select, scoped to a collaboration (existing
// or new), with a role picker. Replaces the old Discover tab.
function InviteModal({
  memberId,
  myCity,
  isAdmin,
  outgoing,
  occasion,
  onClose,
  onInvited,
}: {
  memberId: string;
  myCity: string;
  isAdmin: boolean;
  outgoing: CollabInvite[];
  occasion: { id: string; label: string } | null;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [type, setType] = useState<MemberType | "all">("all");
  const [query, setQuery] = useState("");
  const [nearOnly, setNearOnly] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [composeText, setComposeText] = useState("");
  const [role, setRole] = useState("vendor");
  const [newName, setNewName] = useState("");
  const [newOccId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `occ-${Math.round(performance.now())}`
  );

  // Fixed collaboration (existing) or a new one named in the modal.
  const activeOcc: { id: string; label: string } | null =
    occasion ?? (newName.trim() ? { id: newOccId, label: newName.trim() } : null);

  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // All invites land in the collaboration's single room. 1 collaborator = a 1:1
  // chat; the 2nd makes it a group automatically.
  function addInvitees(invitees: { id: string; name?: string | null }[], message?: string) {
    if (!activeOcc) return Promise.resolve();
    return fetch("/api/vendor/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: activeOcc.label,
        invitees,
        role,
        message: message?.trim() || undefined,
        occasionId: activeOcc.id,
        occasionLabel: activeOcc.label,
        memberId: isAdmin ? memberId : undefined,
      }),
    }).catch(() => {});
  }

  async function addPicked() {
    if (!activeOcc || picked.size === 0) return;
    setBusy(true);
    setMsg("");
    const targets = members.filter((m) => picked.has(m.id));
    try {
      await addInvitees(targets.map((m) => ({ id: m.id, name: m.profile?.name })));
      setSent((s) => {
        const n = new Set(s);
        targets.forEach((m) => n.add(m.id));
        return n;
      });
      setMsg(`Added ${targets.length} to "${activeOcc.label}".`);
      setPicked(new Set());
      onInvited();
    } finally {
      setBusy(false);
    }
  }

  async function invite(m: Member, message?: string) {
    if (!activeOcc) return;
    setSent((s) => new Set(s).add(m.id));
    setComposeFor(null);
    setComposeText("");
    await addInvitees([{ id: m.id, name: m.profile?.name }], message);
    onInvited();
  }

  useEffect(() => {
    listMembers({ limit: 100 })
      .then((r) => setMembers(r.members?.length ? r.members : DEMO_MEMBERS))
      .catch(() => setMembers(DEMO_MEMBERS));
  }, []);

  const invitedIds = useMemo(() => new Set(outgoing.map((o) => o.to_id)), [outgoing]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sameCity = (m: Member) => !!myCity && (m.profile?.city || "").toLowerCase() === myCity.toLowerCase();
    return members
      .filter((m) => m.id !== memberId)
      .filter((m) => type === "all" || m.profile?.memberType === type)
      .filter((m) => !q || (m.profile?.name || "").toLowerCase().includes(q))
      .filter((m) => !nearOnly || sameCity(m))
      .sort((a, b) => (sameCity(a) ? 0 : 1) - (sameCity(b) ? 0 : 1))
      .slice(0, 30);
  }, [members, type, query, memberId, myCity, nearOnly]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">
              {occasion ? `Add to “${occasion.label}”` : "New collaboration"}
            </p>
            <p className="text-xs text-stone-400">Search the network, pick a role, then invite.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {/* New-collab name */}
          {!occasion && (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name this collaboration (e.g. Holiday market)…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          )}

          {/* Role picker (like the event lineup) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500">Role:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm"
            >
              {LINEUP_ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.emoji} {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  type === t.key ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {t.label}
              </button>
            ))}
            {myCity && (
              <button
                onClick={() => setNearOnly((v) => !v)}
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                  nearOnly ? "bg-indigo-600 text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                }`}
                title={`Show only collaborators in ${myCity}`}
              >
                <MapPin className="h-3.5 w-3.5" /> Near me
              </button>
            )}
          </div>

          {picked.size > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <span className="text-sm font-medium text-indigo-800">{picked.size} selected · {roleDef(role).label}</span>
              {!activeOcc ? (
                <span className="text-sm text-indigo-700">Name the collaboration first.</span>
              ) : (
                <button
                  onClick={addPicked}
                  disabled={busy}
                  title={`Add everyone to "${activeOcc.label}"`}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? "Adding…" : `Add to ${activeOcc.label}`}
                </button>
              )}
              <button onClick={() => setPicked(new Set())} className="text-xs text-stone-500 hover:text-stone-700">
                Clear
              </button>
            </div>
          )}
          {msg && <p className="text-sm text-stone-500">{msg}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((m) => {
              const already = sent.has(m.id) || invitedIds.has(m.id);
              return (
                <div key={m.id} className="card-soft min-w-0 p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <label className="flex min-w-0 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={picked.has(m.id)}
                        onChange={() => togglePick(m.id)}
                        className="shrink-0 accent-indigo-600"
                      />
                      <span className="min-w-0">
                        <Link href={`/members/${m.id}`} className="block truncate font-medium text-stone-900 hover:text-indigo-700">
                          {m.profile?.name || "Member"}
                        </Link>
                        <span className="block truncate text-xs text-stone-500">
                          {[m.profile?.memberType, m.profile?.city].filter(Boolean).join(" · ")}
                          {m.profile?.city && m.profile.city === myCity && <span className="ml-1 text-emerald-600">· nearby</span>}
                        </span>
                      </span>
                    </label>
                    <button
                      onClick={() => {
                        if (already || !activeOcc) return;
                        setComposeText("");
                        setComposeFor((cur) => (cur === m.id ? null : m.id));
                      }}
                      disabled={already || !activeOcc}
                      title={!activeOcc ? "Name the collaboration first" : undefined}
                      className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
                    >
                      {already ? "Invited" : composeFor === m.id ? "Cancel" : "Invite"}
                    </button>
                  </div>
                  {composeFor === m.id && !already && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        autoFocus
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && invite(m, composeText)}
                        placeholder="Add a message…"
                        className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => invite(m, composeText)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        <Send className="h-3.5 w-3.5" /> Send
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {results.length === 0 && <p className="text-sm text-stone-400">No matches.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Invites({
  memberId,
  isAdmin,
  incoming,
  onChange,
  openRoom,
}: {
  memberId: string;
  isAdmin: boolean;
  incoming: CollabInvite[];
  onChange: () => void;
  openRoom: (roomId?: string) => void;
}) {
  async function respond(id: string, status: "accepted" | "declined") {
    const res = await fetch(`/api/vendor/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, memberId: isAdmin ? memberId : undefined }),
    });
    onChange();
    // Event-scoped invites have no 1:1 room (the lineup is the shared thread),
    // so only jump to Rooms when a room was actually created.
    const d = await res.json().catch(() => ({}));
    if (status === "accepted" && res.ok && d.room) openRoom(d.room.id);
  }

  const pending = incoming.filter((i) => i.status === "pending");

  return (
    <section>
      <p className="section-label mb-3">Invites for you</p>
      {pending.length === 0 ? (
        <p className="text-sm text-stone-400">No pending invites.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((i) => {
            // A group invite targets an existing group room (room_id set);
            // otherwise it's a 1:1 (a private room is created on accept).
            const isGroup = !!i.room_id;
            return (
              <li key={i.id} className="card-soft flex min-w-0 items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-stone-900">{i.from_name || "A member"}</p>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isGroup ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {isGroup ? <Users className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                      {isGroup ? "Group" : "1:1"}
                    </span>
                  </div>
                  {(i.occasion_label || i.message) && (
                    <p className="truncate text-sm text-stone-500">{i.occasion_label || i.message}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => respond(i.id, "accepted")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => respond(i.id, "declined")}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "accepted"
          ? "bg-emerald-100 text-emerald-700"
          : status === "declined"
            ? "bg-stone-200 text-stone-500"
            : "bg-amber-100 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

// Rooms grouped by collaboration: each collaboration shows its group room +
// individual chats (with all info), plus any one-off rooms under "Other".
function Rooms({
  memberId,
  isAdmin,
  rooms,
  collabs,
  focusRoomId,
  canOwn,
  onInvite,
  onNew,
}: {
  memberId: string;
  isAdmin: boolean;
  rooms: CollabRoom[];
  collabs: CollaborationSummary[];
  focusRoomId: string | null;
  canOwn: boolean;
  onInvite: (occasion: { id: string; label: string }) => void;
  onNew: () => void;
}) {
  const [active, setActive] = useState<CollabRoom | null>(null);

  useEffect(() => {
    if (!focusRoomId) return;
    const r = rooms.find((x) => x.id === focusRoomId);
    if (r) setActive(r);
  }, [focusRoomId, rooms]);

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  // Basic tier: hide owned collaborations — you only see ones you were invited to.
  const visible = canOwn ? collabs : collabs.filter((c) => !c.owned);

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        {canOwn && (
          <button
            onClick={onNew}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:border-indigo-300 hover:text-indigo-700"
          >
            <Plus className="h-4 w-4" /> New collaboration
          </button>
        )}

        {visible.length === 0 && (
          <p className="px-1 text-sm text-stone-400">
            {canOwn ? "No collaborations yet — start one above." : "No collaborations yet — you'll see ones you're invited to here."}
          </p>
        )}

        {visible.map((c) => {
          const room = c.roomId ? roomById.get(c.roomId) : null;
          const isGroup = c.acceptedCount >= 2;
          const accepted = c.members.filter((m) => m.status === "accepted");
          const pending = c.members.filter((m) => m.status !== "accepted");
          const roomLabel = isGroup ? `Group · ${c.acceptedCount + 1}` : accepted[0]?.to_name || c.label;
          // Joined collaborations always have a room to open (we're a member).
          const canOpen = !!room && (!c.owned || accepted.length > 0);
          return (
            <div key={c.occasion_id} className="rounded-xl border border-stone-100 p-2">
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-stone-500">{c.label}</p>
                  {c.owned ? (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-indigo-700">Owner</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-stone-500">Joined</span>
                  )}
                </span>
                {c.eventId ? (
                  <Link
                    href={`/events/${c.eventId}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    <CalendarPlus className="h-3 w-3" /> Event
                  </Link>
                ) : (
                  <span className="shrink-0 text-[10px] text-stone-300">no event</span>
                )}
              </div>

              {canOpen && room ? (
                <button
                  onClick={() => setActive(room)}
                  className={`flex w-full items-center gap-1.5 truncate rounded-lg px-3 py-2 text-left text-sm ${
                    active?.id === room.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {isGroup ? <Users className="h-3.5 w-3.5 shrink-0 text-stone-400" /> : <UserRound className="h-3.5 w-3.5 shrink-0 text-stone-400" />}
                  <span className="truncate">{roomLabel}</span>
                </button>
              ) : (
                <p className="px-3 py-1 text-xs text-stone-400">No one has accepted yet</p>
              )}

              {/* Owner-only: pending invitees + invite control */}
              {c.owned && (
                <>
                  {pending.map((m) => (
                    <div key={m.invite_id} className="flex items-center justify-between gap-2 px-3 py-1 text-sm text-stone-400">
                      <span className="min-w-0 truncate">{m.to_name || "Collaborator"}</span>
                      <StatusPill status={m.status} />
                    </div>
                  ))}
                  <button
                    onClick={() => onInvite({ id: c.occasion_id, label: c.label })}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Invite / add
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {active ? (
        <div className="min-w-0">
          <Chat key={active.id} room={active} memberId={memberId} isAdmin={isAdmin} />
        </div>
      ) : (
        <div className="card-soft flex min-w-0 items-center justify-center p-6 text-sm text-stone-400">
          Pick a chat to open, or start a collaboration.
        </div>
      )}
    </div>
  );
}

function Chat({ room, memberId, isAdmin }: { room: CollabRoom; memberId: string; isAdmin: boolean }) {
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [planning, setPlanning] = useState(false);
  const [planForm, setPlanForm] = useState({ title: "", event_date: "", event_time: "", location: "" });
  const [planBusy, setPlanBusy] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  async function planEvent() {
    if (!planForm.title.trim()) return;
    setPlanBusy(true);
    try {
      const res = await fetch(`/api/vendor/rooms/${room.id}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...planForm, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        setCreatedEventId(d.eventId);
        setPlanning(false);
        setPlanForm({ title: "", event_date: "", event_time: "", location: "" });
        load();
      }
    } finally {
      setPlanBusy(false);
    }
  }

  const load = () => {
    fetch(`/api/vendor/rooms/${room.id}${qp}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => {});
    // Agreement ("I'm in") applies to all rooms — 1:1 and group.
    fetch(`/api/vendor/rooms/${room.id}/members${qp}`)
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers(Array.isArray(d.members) ? d.members : []))
      .catch(() => {});
  };

  // A collaboration room is a 1:1 until a 2nd person joins, then a group.
  const others = members.filter((m) => m.member_id !== memberId);
  const isGroup = others.length >= 2;
  const otherName = isGroup ? room.title || "this group" : others[0]?.member_name || "your collaborator";

  // The arranger = the room owner (whoever created the collaboration).
  const arrangerId = room.owner_id || room.member_a;
  const arrangerName = room.member_a_name || "A collaborator";
  const isArranger = memberId === arrangerId;

  const myAgreed = members.find((m) => m.member_id === memberId)?.agreed ?? false;
  const agreedCount = members.filter((m) => m.agreed).length;
  const allIn = members.length > 0 && agreedCount === members.length;
  // Create event is only allowed (a) by the arranger and (b) once enough are "in":
  //  - 1:1 → both members  ·  group → more than 2
  const enoughIn = isGroup ? agreedCount > 2 : members.length >= 2 && allIn;
  const canCreate = isArranger && enoughIn;
  const gateHint = !isArranger
    ? `Only ${arrangerName} can create the event`
    : isGroup
      ? "More than 2 collaborators need to be in first"
      : "Both of you need to be in first";

  async function toggleAgreed() {
    setMembers((ms) => ms.map((m) => (m.member_id === memberId ? { ...m, agreed: !myAgreed } : m)));
    await fetch(`/api/vendor/rooms/${room.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: !myAgreed, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    load();
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  useEffect(() => {
    // Scroll only the message list — NOT scrollIntoView, which also scrolls the
    // page/window so opening a room jerks the whole page to the bottom.
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await fetch(`/api/vendor/rooms/${room.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, memberId: isAdmin ? memberId : undefined }),
    }).catch(() => {});
    load();
  }

  return (
    <div className="card-soft flex h-[460px] flex-col">
      {/* Header — collaborator/group name + "Create event" (gated on agreement) */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-800">{otherName}</p>
          <p className="truncate text-[11px] text-stone-400">
            Arranged by {isArranger ? "you" : arrangerName}
          </p>
        </div>
        <button
          onClick={() => { if (!canCreate) return; setPlanning((p) => !p); setCreatedEventId(null); }}
          disabled={!canCreate}
          title={canCreate ? undefined : gateHint}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400 disabled:hover:bg-stone-50"
        >
          <CalendarPlus className="h-3.5 w-3.5" /> Create event
        </button>
      </div>

      {/* Consensus bar — who's in (1:1 and group) */}
      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-4 py-2">
          {members.map((m) => (
            <span
              key={m.member_id}
              className={`rounded-full px-2 py-0.5 text-xs ${
                m.agreed ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
              }`}
              title={m.agreed ? "In" : "Not yet"}
            >
              {m.agreed ? "👍 " : "• "}
              {m.member_id === memberId ? "You" : m.member_name || "Member"}
            </span>
          ))}
          <button
            onClick={toggleAgreed}
            className={`ml-auto rounded-lg px-3 py-1 text-xs font-medium ${
              myAgreed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {myAgreed ? "✓ You're in" : "I'm in 👍"}
          </button>
        </div>
      )}

      {planning && (
        <div className="space-y-2 border-b border-stone-100 bg-indigo-50/40 p-3">
          <p className="text-xs text-stone-500">
            {isGroup ? (
              <>
                Creates an event you host. Everyone who&apos;s <strong>in (👍)</strong> joins the lineup; anyone not in is left off
                {allIn ? " — everyone's in!" : ""}. Invite more anytime in Organize.
              </>
            ) : (
              <>Creates an event you host, with {otherName} added to the lineup. Invite more anytime in Organize.</>
            )}
          </p>
          <input
            value={planForm.title}
            onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input value={planForm.event_date} onChange={(e) => setPlanForm((f) => ({ ...f, event_date: e.target.value }))} placeholder="Date" className="w-1/2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm" />
            <input value={planForm.event_time} onChange={(e) => setPlanForm((f) => ({ ...f, event_time: e.target.value }))} placeholder="Time" className="w-1/2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm" />
          </div>
          <input value={planForm.location} onChange={(e) => setPlanForm((f) => ({ ...f, location: e.target.value }))} placeholder="Location" className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm" />
          <button
            onClick={planEvent}
            disabled={planBusy || !planForm.title.trim() || !canCreate}
            title={canCreate ? undefined : gateHint}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {planBusy ? "Creating…" : "Create event"}
          </button>
        </div>
      )}

      {createdEventId && (
        <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          <Check className="h-3.5 w-3.5" /> Event created.
          <Link href={`/vendor/organize`} className="font-medium underline">Manage lineup</Link>
          <Link href={`/events/${createdEventId}`} className="font-medium underline">View event</Link>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-stone-400">Say hello 👋</p>}
        {messages.map((m) => {
          const mine = m.sender_id === memberId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] break-words rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800"
                }`}
              >
                {!mine && <p className="text-[10px] font-medium opacity-70">{m.sender_name || "Them"}</p>}
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-stone-100 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <button onClick={send} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
