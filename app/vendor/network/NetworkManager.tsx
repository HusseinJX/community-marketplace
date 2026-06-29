"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users, MessageSquare, Send, Check, X, CalendarPlus, MapPin } from "lucide-react";
import { listMembers } from "@/lib/api";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import type { Member, MemberType } from "@/lib/types";
import type { CollabInvite, CollabRoom, CollabMessage, RoomMember } from "@/lib/collab-network";

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
  const [tab, setTab] = useState<Tab>("discover");
  const [incoming, setIncoming] = useState<CollabInvite[]>([]);
  const [outgoing, setOutgoing] = useState<CollabInvite[]>([]);
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const qp = isAdmin ? `?memberId=${memberId}` : "";

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

  useEffect(() => {
    loadInvites();
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp]);

  const pendingIn = incoming.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
          <Users className="h-6 w-6 text-indigo-500" /> Your network
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Find nearby vendors, artists, and community orgs to collaborate with — send an invite, and
          when they accept you get a shared room to plan it.
        </p>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {([
          ["discover", "Discover"],
          ["invites", `Invites${pendingIn ? ` (${pendingIn})` : ""}`],
          ["rooms", `Rooms${rooms.length ? ` (${rooms.length})` : ""}`],
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

      {tab === "discover" && (
        <Discover memberId={memberId} myCity={myCity} isAdmin={isAdmin} outgoing={outgoing} onInvited={loadInvites} />
      )}
      {tab === "invites" && (
        <Invites
          memberId={memberId}
          isAdmin={isAdmin}
          incoming={incoming}
          outgoing={outgoing}
          onChange={() => {
            loadInvites();
            loadRooms();
          }}
          openRoom={() => setTab("rooms")}
        />
      )}
      {tab === "rooms" && <Rooms memberId={memberId} isAdmin={isAdmin} rooms={rooms} />}
    </div>
  );
}

function Discover({
  memberId,
  myCity,
  isAdmin,
  outgoing,
  onInvited,
}: {
  memberId: string;
  myCity: string;
  isAdmin: boolean;
  outgoing: CollabInvite[];
  onInvited: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [type, setType] = useState<MemberType | "all">("all");
  const [query, setQuery] = useState("");
  const [nearOnly, setNearOnly] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [groupTitle, setGroupTitle] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupMsg, setGroupMsg] = useState("");

  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function createGroup() {
    if (!groupTitle.trim() || picked.size === 0) return;
    setCreatingGroup(true);
    setGroupMsg("");
    const invitees = members
      .filter((m) => picked.has(m.id))
      .map((m) => ({ id: m.id, name: m.profile?.name }));
    try {
      const res = await fetch("/api/vendor/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: groupTitle.trim(), invitees, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setGroupMsg(`Group "${groupTitle.trim()}" created — invited ${d.invited}. Open the Rooms tab to chat.`);
      setPicked(new Set());
      setGroupTitle("");
      onInvited();
    } catch (e) {
      setGroupMsg(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  }

  useEffect(() => {
    listMembers({ limit: 100 })
      .then((r) => setMembers(r.members?.length ? r.members : DEMO_MEMBERS))
      .catch(() => setMembers(DEMO_MEMBERS));
  }, []);

  const invitedIds = useMemo(
    () => new Set(outgoing.map((o) => o.to_id)),
    [outgoing]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sameCity = (m: Member) => !!myCity && (m.profile?.city || "").toLowerCase() === myCity.toLowerCase();
    return members
      .filter((m) => m.id !== memberId)
      .filter((m) => type === "all" || m.profile?.memberType === type)
      .filter((m) => !q || (m.profile?.name || "").toLowerCase().includes(q))
      .filter((m) => !nearOnly || sameCity(m))
      // surface same-city collaborators first
      .sort((a, b) => (sameCity(a) ? 0 : 1) - (sameCity(b) ? 0 : 1))
      .slice(0, 30);
  }, [members, type, query, memberId, myCity, nearOnly]);

  async function invite(m: Member) {
    setSent((s) => new Set(s).add(m.id));
    await fetch("/api/vendor/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: isAdmin ? memberId : undefined,
        toId: m.id,
        toName: m.profile?.name,
      }),
    }).catch(() => {});
    onInvited();
  }

  return (
    <div className="space-y-4">
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

      {/* Group builder — select several, name it, start one shared room */}
      {picked.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <span className="text-sm font-medium text-indigo-800">{picked.size} selected</span>
          <input
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            placeholder="Name this collaboration…"
            className="min-w-[180px] flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
          />
          <button
            onClick={createGroup}
            disabled={creatingGroup || !groupTitle.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creatingGroup ? "Creating…" : "Start group"}
          </button>
          <button onClick={() => setPicked(new Set())} className="text-xs text-stone-500 hover:text-stone-700">
            Clear
          </button>
        </div>
      )}
      {groupMsg && <p className="text-sm text-stone-500">{groupMsg}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((m) => {
          const already = sent.has(m.id) || invitedIds.has(m.id);
          return (
            <div key={m.id} className="card-soft flex min-w-0 items-center justify-between gap-3 p-3">
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
                    {m.profile?.city && m.profile.city === myCity && (
                      <span className="ml-1 text-emerald-600">· nearby</span>
                    )}
                  </span>
                </span>
              </label>
              <button
                onClick={() => invite(m)}
                disabled={already}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
              >
                {already ? "Invited" : "Invite"}
              </button>
            </div>
          );
        })}
        {results.length === 0 && <p className="text-sm text-stone-400">No matches.</p>}
      </div>
      <p className="text-xs text-stone-400">
        Tip: check several members and name a collaboration to start one <strong>group room</strong> — when everyone&apos;s in, turn it into an event.
      </p>
    </div>
  );
}

function Invites({
  memberId,
  isAdmin,
  incoming,
  outgoing,
  onChange,
  openRoom,
}: {
  memberId: string;
  isAdmin: boolean;
  incoming: CollabInvite[];
  outgoing: CollabInvite[];
  onChange: () => void;
  openRoom: () => void;
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
    if (status === "accepted" && res.ok && d.room) openRoom();
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="section-label mb-3">Invites for you</p>
        {incoming.filter((i) => i.status === "pending").length === 0 ? (
          <p className="text-sm text-stone-400">No pending invites.</p>
        ) : (
          <ul className="space-y-3">
            {incoming
              .filter((i) => i.status === "pending")
              .map((i) => (
                <li key={i.id} className="card-soft flex min-w-0 items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{i.from_name || "A member"}</p>
                    {i.message && <p className="truncate text-sm text-stone-500">{i.message}</p>}
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
              ))}
          </ul>
        )}
      </section>

      <section>
        <p className="section-label mb-3">Sent</p>
        {outgoing.length === 0 ? (
          <p className="text-sm text-stone-400">You haven&apos;t sent any invites.</p>
        ) : (
          <ul className="space-y-2">
            {outgoing.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-stone-700">{o.to_name || "A member"}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    o.status === "accepted"
                      ? "bg-emerald-100 text-emerald-700"
                      : o.status === "declined"
                        ? "bg-stone-200 text-stone-500"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Rooms({ memberId, isAdmin, rooms }: { memberId: string; isAdmin: boolean; rooms: CollabRoom[] }) {
  const [active, setActive] = useState<CollabRoom | null>(null);

  if (rooms.length === 0) {
    return (
      <div className="card-soft p-6 text-center text-sm text-stone-400">
        <MessageSquare className="mx-auto mb-2 h-6 w-6 text-stone-300" />
        No collab rooms yet. Accept an invite to start one.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <ul className="space-y-1">
        {rooms.map((r) => {
          const label = r.is_group
            ? r.title || "Group collab"
            : (r.member_a === memberId ? r.member_b_name : r.member_a_name) || "Collaborator";
          return (
            <li key={r.id}>
              <button
                onClick={() => setActive(r)}
                className={`flex w-full items-center gap-1.5 truncate rounded-lg px-3 py-2 text-left text-sm ${
                  active?.id === r.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                {r.is_group && <Users className="h-3.5 w-3.5 shrink-0 text-stone-400" />}
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <div className="min-w-0">
          <Chat key={active.id} room={active} memberId={memberId} isAdmin={isAdmin} />
        </div>
      ) : (
        <div className="card-soft flex min-w-0 items-center justify-center p-6 text-sm text-stone-400">
          Pick a room to chat.
        </div>
      )}
    </div>
  );
}

function Chat({ room, memberId, isAdmin }: { room: CollabRoom; memberId: string; isAdmin: boolean }) {
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const otherName = room.is_group
    ? room.title || "this group"
    : (room.member_a === memberId ? room.member_b_name : room.member_a_name) || "your collaborator";
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
    if (room.is_group) {
      fetch(`/api/vendor/rooms/${room.id}/members${qp}`)
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((d) => setMembers(Array.isArray(d.members) ? d.members : []))
        .catch(() => {});
    }
  };

  const myAgreed = members.find((m) => m.member_id === memberId)?.agreed ?? false;
  const allIn = members.length > 0 && members.every((m) => m.agreed);

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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
      {/* Header — collaborator/group name + "Plan an event together" */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
        <p className="truncate text-sm font-medium text-stone-800">{otherName}</p>
        <button
          onClick={() => { setPlanning((p) => !p); setCreatedEventId(null); }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
        >
          <CalendarPlus className="h-3.5 w-3.5" /> Plan an event
        </button>
      </div>

      {/* Group consensus bar — who's in */}
      {room.is_group && (
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
            {room.is_group ? (
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
            disabled={planBusy || !planForm.title.trim()}
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

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
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
        <div ref={endRef} />
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
