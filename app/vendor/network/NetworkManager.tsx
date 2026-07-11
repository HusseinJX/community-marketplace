"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Users, UserRound, Send, Check, X, CalendarPlus, Plus, Lock } from "lucide-react";
import { MatchFinder } from "@/components/match/MatchFinder";
import type { MatchCandidate } from "@/lib/types";
import type { CollabInvite, CollabRoom, CollabMessage, RoomMember, CollaborationSummary } from "@/lib/collab-network";
import { LINEUP_ROLES, roleDef } from "@/lib/lineup-roles";

type Tab = "discover" | "invites" | "rooms";

// ── Admin-demo content ──────────────────────────────────────────────────────
// Illustrative collaborations shown in the demo (no real backend). Kept rich —
// a couple of 1:1s plus a group you host — so the demo mirrors the real network.
const DEMO_INCOMING = (memberId: string): CollabInvite[] => [
  {
    id: "demo-inv-1", from_id: "demo-cafe", from_name: "Nokku Coffee", to_id: memberId, to_name: "You",
    message: "Want to co-host a weekend pop-up?", status: "pending", room_id: null,
    scope_type: "collab", scope_id: null, role: "vendor", occasion_id: "demo-occ-a",
    occasion_label: "Weekend pop-up", created_at: "2026-06-28T15:00:00.000Z",
  },
  {
    id: "demo-inv-2", from_id: "demo-muralist", from_name: "Dani Cruz", to_id: memberId, to_name: "You",
    message: "Mural + launch collab?", status: "pending", room_id: null,
    scope_type: "collab", scope_id: null, role: "artist", occasion_id: "demo-occ-b",
    occasion_label: "Storefront mural", created_at: "2026-06-27T15:00:00.000Z",
  },
];

const DEMO_ROOMS = (memberId: string): CollabRoom[] => [
  {
    id: "demo-room-1", member_a: "demo-cafe", member_a_name: "Nokku Coffee", member_b: memberId, member_b_name: "You",
    is_group: false, title: "Weekend pop-up", owner_id: "demo-cafe", occasion_id: "demo-occ-1",
    occasion_label: "Weekend pop-up", event_id: null, created_at: "2026-06-28T15:00:00.000Z",
  },
  {
    id: "demo-room-2", member_a: "demo-muralist", member_a_name: "Dani Cruz", member_b: memberId, member_b_name: "You",
    is_group: false, title: "Storefront mural", owner_id: "demo-muralist", occasion_id: "demo-occ-2",
    occasion_label: "Storefront mural", event_id: null, created_at: "2026-06-27T15:00:00.000Z",
  },
  {
    id: "demo-room-3", member_a: memberId, member_a_name: "You", member_b: "demo-cafe", member_b_name: "Nokku Coffee",
    is_group: false, title: "Coffee + pastry pairing", owner_id: memberId, occasion_id: "demo-occ-3",
    occasion_label: "Coffee + pastry pairing", event_id: null, created_at: "2026-06-25T15:00:00.000Z",
  },
  {
    id: "demo-room-4", member_a: memberId, member_a_name: "You", member_b: "demo-muralist", member_b_name: "Dani Cruz",
    is_group: true, title: "Neighborhood Night Market", owner_id: memberId, occasion_id: "demo-occ-4",
    occasion_label: "Neighborhood Night Market", event_id: null, created_at: "2026-06-24T15:00:00.000Z",
  },
  // An individual 1:1 chat that sits ALONGSIDE the Night Market group above.
  {
    id: "demo-occ-4-demo-studio", member_a: memberId, member_a_name: "You", member_b: "demo-studio", member_b_name: "Studio Nine",
    is_group: false, title: "Studio Nine", owner_id: memberId, occasion_id: "demo-occ-4",
    occasion_label: "Neighborhood Night Market", event_id: null, created_at: "2026-06-24T16:00:00.000Z",
  },
  {
    id: "demo-room-5", member_a: memberId, member_a_name: "You", member_b: "demo-cantina", member_b_name: "El Tri Cantina",
    is_group: true, title: "Summer Block Party", owner_id: memberId, occasion_id: "demo-occ-5",
    occasion_label: "Summer Block Party", event_id: "demo-ev-block", created_at: "2026-06-20T15:00:00.000Z",
  },
  // A collab whose invitees each ACCEPTED but aren't merged into a group yet —
  // each is its own individual chat. Room id convention: `${occasion}-${to_id}`.
  {
    id: "demo-occ-6-demo-cafe", member_a: memberId, member_a_name: "You", member_b: "demo-cafe", member_b_name: "Nokku Coffee",
    is_group: false, title: "Nokku Coffee", owner_id: memberId, occasion_id: "demo-occ-6",
    occasion_label: "Farmers Market Booths", event_id: null, created_at: "2026-06-19T15:00:00.000Z",
  },
  {
    id: "demo-occ-6-demo-muralist", member_a: memberId, member_a_name: "You", member_b: "demo-muralist", member_b_name: "Dani Cruz",
    is_group: false, title: "Dani Cruz", owner_id: memberId, occasion_id: "demo-occ-6",
    occasion_label: "Farmers Market Booths", event_id: null, created_at: "2026-06-19T15:00:00.000Z",
  },
  {
    id: "demo-occ-6-demo-greenhouse", member_a: memberId, member_a_name: "You", member_b: "demo-greenhouse", member_b_name: "Greenhouse Project",
    is_group: false, title: "Greenhouse Project", owner_id: memberId, occasion_id: "demo-occ-6",
    occasion_label: "Farmers Market Booths", event_id: null, created_at: "2026-06-19T15:00:00.000Z",
  },
];

const DEMO_COLLABS: CollaborationSummary[] = [
  // Individual (1:1) chats — a couple you were invited to, one you started.
  { occasion_id: "demo-occ-1", label: "Weekend pop-up", roomId: "demo-room-1", eventId: null, owned: false, acceptedCount: 1, members: [] },
  { occasion_id: "demo-occ-2", label: "Storefront mural", roomId: "demo-room-2", eventId: null, owned: false, acceptedCount: 1, members: [] },
  {
    occasion_id: "demo-occ-3", label: "Coffee + pastry pairing", roomId: "demo-room-3", eventId: null, owned: true, acceptedCount: 1,
    members: [{ invite_id: "demo-m-0", to_id: "demo-cafe", to_name: "Nokku Coffee", status: "accepted", role: "vendor" }],
  },
  // Group you host — members accepted + one still pending (the "add to group" flow).
  {
    occasion_id: "demo-occ-4", label: "Neighborhood Night Market", roomId: "demo-room-4", eventId: null, owned: true, acceptedCount: 3,
    members: [
      { invite_id: "demo-m-1", to_id: "demo-muralist", to_name: "Dani Cruz", status: "accepted", role: "artist" },
      { invite_id: "demo-m-2", to_id: "demo-cantina", to_name: "El Tri Cantina", status: "accepted", role: "food" },
      { invite_id: "demo-m-3", to_id: "demo-greenhouse", to_name: "Greenhouse Project", status: "accepted", role: "partner" },
      { invite_id: "demo-m-4", to_id: "demo-studio", to_name: "Studio Nine", status: "accepted", role: "vendor" },
    ],
  },
  // Group you host with an event already created (shows the "Event" link).
  {
    occasion_id: "demo-occ-5", label: "Summer Block Party", roomId: "demo-room-5", eventId: "demo-ev-block", owned: true, acceptedCount: 2,
    members: [
      { invite_id: "demo-m-5", to_id: "demo-cantina", to_name: "El Tri Cantina", status: "accepted", role: "food" },
      { invite_id: "demo-m-6", to_id: "demo-greenhouse", to_name: "Greenhouse Project", status: "accepted", role: "partner" },
    ],
  },
  // Invitees accepted individually but NOT merged into a group — each is its own
  // 1:1 chat (no group roomId). "Add to group" combines them.
  {
    occasion_id: "demo-occ-6", label: "Farmers Market Booths", roomId: null, eventId: null, owned: true, acceptedCount: 3,
    members: [
      { invite_id: "demo-m-7", to_id: "demo-cafe", to_name: "Nokku Coffee", status: "accepted", role: "vendor" },
      { invite_id: "demo-m-8", to_id: "demo-muralist", to_name: "Dani Cruz", status: "accepted", role: "artist" },
      { invite_id: "demo-m-9", to_id: "demo-greenhouse", to_name: "Greenhouse Project", status: "accepted", role: "partner" },
    ],
  },
];

// Per-room participants (with agreement state) + a short transcript, so the
// demo chat shows the real "I'm in" consensus bar and messages.
const DEMO_PEOPLE: Record<string, { name: string; agreed: boolean }[]> = {
  "demo-room-1": [{ name: "You", agreed: true }, { name: "Nokku Coffee", agreed: false }],
  "demo-room-2": [{ name: "You", agreed: false }, { name: "Dani Cruz", agreed: true }],
  "demo-room-3": [{ name: "You", agreed: true }, { name: "Nokku Coffee", agreed: true }],
  "demo-room-4": [
    { name: "You", agreed: true },
    { name: "Dani Cruz", agreed: true },
    { name: "El Tri Cantina", agreed: true },
    { name: "Greenhouse Project", agreed: false },
  ],
  "demo-room-5": [
    { name: "You", agreed: true },
    { name: "El Tri Cantina", agreed: true },
    { name: "Greenhouse Project", agreed: true },
  ],
  "demo-occ-6-demo-cafe": [{ name: "You", agreed: true }, { name: "Nokku Coffee", agreed: true }],
  "demo-occ-6-demo-muralist": [{ name: "You", agreed: true }, { name: "Dani Cruz", agreed: true }],
  "demo-occ-6-demo-greenhouse": [{ name: "You", agreed: true }, { name: "Greenhouse Project", agreed: true }],
  "demo-occ-4-demo-studio": [{ name: "You", agreed: true }, { name: "Studio Nine", agreed: false }],
};
const DEMO_TRANSCRIPT: Record<string, { mine: boolean; name: string; text: string }[]> = {
  "demo-room-1": [
    { mine: false, name: "Nokku Coffee", text: "Hey! Want to co-host a weekend pop-up at our place?" },
    { mine: true, name: "You", text: "Love that. We could bring a merch table + tastings." },
    { mine: false, name: "Nokku Coffee", text: "Perfect — let's lock a date and split promo." },
  ],
  "demo-room-2": [
    { mine: false, name: "Dani Cruz", text: "Could paint a mural on your storefront for the launch." },
    { mine: true, name: "You", text: "Yes! Let's talk colors + timeline." },
  ],
  "demo-room-3": [
    { mine: true, name: "You", text: "Want to run a coffee + pastry pairing pop-up?" },
    { mine: false, name: "Nokku Coffee", text: "In. We'll bring the espresso bar." },
  ],
  "demo-room-4": [
    { mine: true, name: "You", text: "Thinking a night market on Valencia — food, art, live music." },
    { mine: false, name: "Dani Cruz", text: "I'm in! I'll do a live mural wall." },
    { mine: false, name: "El Tri Cantina", text: "We'll run a taco + agua fresca stand 🌮" },
    { mine: false, name: "Greenhouse Project", text: "Can we get a plant swap corner? Checking our calendar." },
  ],
  "demo-room-5": [
    { mine: true, name: "You", text: "Block party is a go — event's live, invite your crews!" },
    { mine: false, name: "El Tri Cantina", text: "🔥 Added it to our calendar." },
  ],
  "demo-occ-6-demo-cafe": [
    { mine: true, name: "You", text: "Want a booth at the farmers market series?" },
    { mine: false, name: "Nokku Coffee", text: "Yes — cold brew cart, count us in." },
  ],
  "demo-occ-6-demo-muralist": [
    { mine: true, name: "You", text: "Booth + a live sketch corner?" },
    { mine: false, name: "Dani Cruz", text: "Accepted! I'll bring prints too." },
  ],
  "demo-occ-6-demo-greenhouse": [
    { mine: true, name: "You", text: "Seedling booth for the market?" },
    { mine: false, name: "Greenhouse Project", text: "In! We'll do a kids' pot-painting table." },
  ],
  "demo-occ-4-demo-studio": [
    { mine: true, name: "You", text: "Want your own booth at the Night Market too?" },
    { mine: false, name: "Studio Nine", text: "Accepted! Still deciding if we join the group thread." },
  ],
};

// Rooms with an event already created → the chat shows an "Event" link instead
// of the Create-event button.
const DEMO_EVENT_BY_ROOM: Record<string, { id: string; title: string }> = {
  "demo-room-5": { id: "demo-ev-block", title: "Summer Block Party" },
};

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
  // The vendor Admin demo has no real backend, so seed illustrative data for
  // every tier (Basic/Pro too) — not just Free. Interactions stay inert.
  adminDemo?: boolean;
  plan?: "free" | "member" | "pro";
}) {
  // No real backend → seed demo data + keep interactions inert. True on Free
  // (the real-app preview) and anywhere in the Admin demo.
  const preview = demo || adminDemo;
  const [tab, setTab] = useState<Tab>("rooms");
  const [incoming, setIncoming] = useState<CollabInvite[]>([]);
  const [outgoing, setOutgoing] = useState<CollabInvite[]>([]);
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [collabs, setCollabs] = useState<CollaborationSummary[]>([]);
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  // Invite modal — `occasion` null = create a new collaboration.
  const [modal, setModal] = useState<{ occasion: { id: string; label: string } | null } | null>(null);
  // Only Pro can start/own collaborations; Basic joins ones they're invited to.
  // Driven by the shared plan switch (falls back to Pro for standalone usage).
  const canOwn = (plan ?? "pro") === "pro";
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
    // Free: you're not in the network, so there's nothing real to load. Show
    // illustrative demo data only — one demo collaboration + a couple demo
    // invites — each paired with a card that explains it's a preview and that
    // real network access needs Basic.
    if (preview) {
      setIncoming(DEMO_INCOMING(memberId));
      setOutgoing([]);
      setRooms(DEMO_ROOMS(memberId));
      setCollabs(DEMO_COLLABS);
      return;
    }
    loadInvites();
    loadRooms();
    loadCollabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp, preview]);

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
      </div>
      {!canOwn && !demo && (
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
          demo={demo}
          inert={preview}
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
          demo={demo}
          inert={preview}
          rooms={rooms}
          collabs={collabs}
          focusRoomId={focusRoomId}
          canOwn={canOwn}
          onInvite={(occ) => setModal({ occasion: occ })}
          onNew={() => setModal({ occasion: null })}
        />
      )}

      {modal &&
        (preview ? (
          <DemoInviteModal occasion={modal.occasion} onClose={() => setModal(null)} />
        ) : (
          <InviteModal
            memberId={memberId}
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
        ))}
    </div>
  );
}

// Invite modal — the network search/select, scoped to a collaboration (existing
// or new), with a role picker. Replaces the old Discover tab.
function InviteModal({
  memberId,
  isAdmin,
  outgoing,
  occasion,
  onClose,
  onInvited,
}: {
  memberId: string;
  isAdmin: boolean;
  outgoing: CollabInvite[];
  occasion: { id: string; label: string } | null;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("vendor");
  const [newName, setNewName] = useState("");
  const [newOccId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `occ-${Math.round(performance.now())}`
  );

  // Fixed collaboration (existing) or a new one named in the modal.
  const activeOcc: { id: string; label: string } | null =
    occasion ?? (newName.trim() ? { id: newOccId, label: newName.trim() } : null);

  const togglePick = (c: MatchCandidate) =>
    setPicked((s) => {
      const n = new Map(s);
      if (n.has(c.id)) n.delete(c.id);
      else n.set(c.id, c);
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
    const targets = [...picked.values()];
    try {
      await addInvitees(
        targets.map((m) => ({ id: m.id, name: m.name })),
        note,
      );
      setSent((s) => {
        const n = new Set(s);
        targets.forEach((m) => n.add(m.id));
        return n;
      });
      setMsg(`Added ${targets.length} to "${activeOcc.label}".`);
      setPicked(new Map());
      setNote("");
      onInvited();
    } finally {
      setBusy(false);
    }
  }

  const invitedIds = useMemo(() => new Set(outgoing.map((o) => o.to_id)), [outgoing]);

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

          {/* Semantic match finder — complementary "for you" + NL search,
              replacing the old name-substring filter over a flat directory. */}
          <MatchFinder
            memberId={memberId}
            isAdmin={isAdmin}
            selected={new Set(picked.keys())}
            onToggle={togglePick}
            sentIds={new Set([...sent, ...invitedIds])}
            excludeIds={new Set([memberId])}
          />

          {msg && <p className="text-sm text-stone-500">{msg}</p>}
        </div>

        {/* Sticky action bar — appears once collaborators are selected */}
        {picked.size > 0 && (
          <div className="space-y-2 border-t border-stone-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-indigo-800">
                {picked.size} selected · {roleDef(role).label}
              </span>
              <button onClick={() => setPicked(new Map())} className="text-xs text-stone-500 hover:text-stone-700">
                Clear
              </button>
            </div>
            {!activeOcc ? (
              <p className="text-sm text-indigo-700">Name the collaboration first.</p>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a message (optional)…"
                  className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={addPicked}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? "Adding…" : `Add to ${activeOcc.label}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Free-tier notice — explains the surface is demo data + why (not in the
// network) alongside the demo content, with an upgrade CTA.
function NetworkNoticeCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <Lock className="h-4 w-4 text-amber-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">{title}</p>
        <p className="mt-0.5 text-xs text-amber-700">{body}</p>
      </div>
      <Link
        href="/vendor/billing"
        className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
      >
        Upgrade to Basic
      </Link>
    </div>
  );
}

// Demo collaboration chat — mirrors the real room (header + Create-event, the
// "I'm in" consensus bar with participants, transcript, and a message box) but
// runs entirely locally: no API calls. Used in the Free preview + Admin demo.
function DemoChat({ room, memberId, canOwn, hasGroup }: { room: CollabRoom; memberId: string; canOwn?: boolean; hasGroup?: boolean }) {
  const otherName = room.member_a_name === "You" ? room.member_b_name : room.member_a_name;
  const title = (room.is_group ? room.title : otherName) || room.title || "Collaboration";
  const owned = room.owner_id === memberId;
  const people = DEMO_PEOPLE[room.id] ?? [
    { name: "You", agreed: true },
    { name: otherName || "Collaborator", agreed: false },
  ];
  const [msgs, setMsgs] = useState(() => DEMO_TRANSCRIPT[room.id] ?? []);
  const [text, setText] = useState("");
  const [meIn, setMeIn] = useState(people.find((p) => p.name === "You")?.agreed ?? false);
  const [planning, setPlanning] = useState(false);
  const [planForm, setPlanForm] = useState({ title: room.title ?? "", date: "", location: "" });
  // An event may already exist for this room, or you create one here (demo).
  const [createdEvent, setCreatedEvent] = useState<{ id: string; title: string } | null>(
    DEMO_EVENT_BY_ROOM[room.id] ?? null
  );
  // An individual chat that belongs to a collab which already has a group room
  // offers "Add to group chat" instead of "Create event".
  const isIndividualInGroup = !room.is_group && !!hasGroup;
  const [addedToGroup, setAddedToGroup] = useState(false);
  const canCreateEvent = canOwn && owned && !createdEvent && !isIndividualInGroup;

  function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    setMsgs((m) => [...m, { mine: true, name: "You", text: t }]);
  }

  return (
    <div className="card-soft flex h-[460px] flex-col">
      {/* Header — collaborator/group name + event control */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-800">{title}</p>
          <p className="truncate text-[11px] text-stone-400">
            {owned ? "Arranged by you" : room.is_group ? `Group · ${people.length}` : "Direct collaboration"}
          </p>
        </div>
        {isIndividualInGroup && owned && canOwn ? (
          <button
            onClick={() => setAddedToGroup(true)}
            disabled={addedToGroup}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              addedToGroup ? "bg-emerald-100 text-emerald-700" : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {addedToGroup ? <Check className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
            {addedToGroup ? "In group chat" : "Add to group chat"}
          </button>
        ) : createdEvent ? (
          DEMO_EVENT_BY_ROOM[room.id] ? (
            <Link
              href={`/events/${createdEvent.id}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Event
            </Link>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Event created
            </span>
          )
        ) : canCreateEvent ? (
          <button
            onClick={() => setPlanning((p) => !p)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Create event
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Demo</span>
        )}
      </div>

      {/* Create-event panel (demo) */}
      {planning && (
        <div className="space-y-2 border-b border-stone-100 bg-indigo-50/40 p-3">
          <p className="text-xs text-stone-500">
            Creates an event you host; everyone who&apos;s <strong>in (👍)</strong> joins the lineup.
          </p>
          <input
            value={planForm.title}
            onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input value={planForm.date} onChange={(e) => setPlanForm((f) => ({ ...f, date: e.target.value }))} placeholder="Date" className="w-1/2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm" />
            <input value={planForm.location} onChange={(e) => setPlanForm((f) => ({ ...f, location: e.target.value }))} placeholder="Location" className="w-1/2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm" />
          </div>
          <button
            onClick={() => { setCreatedEvent({ id: "demo-new-event", title: planForm.title || room.title || "Event" }); setPlanning(false); }}
            disabled={!planForm.title.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Create event
          </button>
        </div>
      )}

      {/* Consensus bar — who's in, with the "I'm in" toggle */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-4 py-2">
        {people.map((p) => {
          const inn = p.name === "You" ? meIn : p.agreed;
          return (
            <span
              key={p.name}
              className={`rounded-full px-2 py-0.5 text-xs ${inn ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
            >
              {inn ? "👍 " : "• "}
              {p.name}
            </span>
          );
        })}
        <button
          onClick={() => setMeIn((v) => !v)}
          className={`ml-auto rounded-lg px-3 py-1 text-xs font-medium ${
            meIn ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          {meIn ? "✓ You're in" : "I'm in 👍"}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] break-words rounded-2xl px-3 py-1.5 text-sm ${m.mine ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800"}`}>
              {!m.mine && <p className="text-[10px] font-medium opacity-70">{m.name}</p>}
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Message box — works locally in the demo */}
      <div className="flex items-center gap-2 border-t border-stone-100 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message your collaborators…"
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
        />
        <button onClick={send} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Demo invite modal — the "Invite / add" and "New collaboration" flow in the
// preview. Shows sample nearby businesses with a local "Invite" toggle; makes no
// API calls (the real modal would 401 with no auth).
const DEMO_CANDIDATES = [
  { id: "demo-cafe", name: "Nokku Coffee", tag: "Café · Mission" },
  { id: "demo-muralist", name: "Dani Cruz", tag: "Muralist · Boyle Heights" },
  { id: "demo-cantina", name: "El Tri Cantina", tag: "Bar · Boyle Heights" },
  { id: "demo-greenhouse", name: "Greenhouse Project", tag: "Garden · Highland Park" },
  { id: "demo-studio", name: "Studio Nine", tag: "Art studio · Hayes Valley" },
];
function DemoInviteModal({
  occasion,
  onClose,
}: {
  occasion: { id: string; label: string } | null;
  onClose: () => void;
}) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              {occasion ? `Invite to ${occasion.label}` : "New collaboration"}
            </h2>
            <p className="text-xs text-stone-500">Nearby businesses matched for you (demo).</p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-stone-400" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {DEMO_CANDIDATES.map((c) => {
            const isInvited = invited.has(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{c.name}</p>
                  <p className="truncate text-[11px] text-stone-400">{c.tag}</p>
                </div>
                <button
                  onClick={() => setInvited((s) => new Set(s).add(c.id))}
                  disabled={isInvited}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    isInvited
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isInvited ? "Invited ✓" : "Invite"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] text-stone-400">Demo — invites are simulated.</p>
      </div>
    </div>
  );
}

function Invites({
  memberId,
  isAdmin,
  demo,
  inert,
  incoming,
  onChange,
  openRoom,
}: {
  memberId: string;
  isAdmin: boolean;
  demo?: boolean;
  inert?: boolean;
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
      {demo && (
        <div className="mb-4">
          <NetworkNoticeCard
            title="You're not in the network yet"
            body="In Free you can't get invites because you're not in the network. The invites below are demo data. Upgrade to Basic to be in the network and receive real invites."
          />
        </div>
      )}
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
                    onClick={() => !inert && respond(i.id, "accepted")}
                    disabled={inert}
                    title={inert ? "Demo invite" : undefined}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:hover:bg-stone-200"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => !inert && respond(i.id, "declined")}
                    disabled={inert}
                    title={inert ? "Demo invite" : undefined}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-stone-100"
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
  demo,
  inert,
  rooms,
  collabs,
  focusRoomId,
  canOwn,
  onInvite,
  onNew,
}: {
  memberId: string;
  isAdmin: boolean;
  demo?: boolean;
  inert?: boolean;
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
  // Every tier sees all their collaborations as chat rooms — the "basic view".
  // The invite/add/new controls are gated on canOwn (Pro) below.
  const visible = collabs;

  return (
    <div className="space-y-4">
      {demo && (
        <NetworkNoticeCard
          title="You're not in the network yet"
          body="In Free you're not in the network, so you can't get invites or join a collaboration. The collaboration and chat below are demo data. Upgrade to Basic to join the network."
        />
      )}
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
          const isGroup = !!room && c.acceptedCount >= 2;
          const accepted = c.members.filter((m) => m.status === "accepted");
          const pending = c.members.filter((m) => m.status !== "accepted");
          const roomLabel = isGroup ? `Group · ${c.acceptedCount + 1}` : accepted[0]?.to_name || c.label;
          // Joined collaborations always have a room to open (we're a member).
          const canOpen = !!room && (!c.owned || accepted.length > 0);
          // Accepted invitees that also have their own 1:1 room — shown as
          // individual chats (a collab can have BOTH a group room and these).
          const individualChats = accepted
            .map((m) => ({ m, r: roomById.get(`${c.occasion_id}-${m.to_id}`) }))
            .filter((x): x is { m: typeof x.m; r: CollabRoom } => !!x.r);
          return (
            <div key={c.occasion_id} className="rounded-xl border border-stone-100 p-2">
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-stone-500">{c.label}</p>
                  {c.owned && canOwn ? (
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

              {/* Group / shared room (if any) */}
              {canOpen && room && (
                <button
                  onClick={() => setActive(room)}
                  className={`flex w-full items-center gap-1.5 truncate rounded-lg px-3 py-2 text-left text-sm ${
                    active?.id === room.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {isGroup ? <Users className="h-3.5 w-3.5 shrink-0 text-stone-400" /> : <UserRound className="h-3.5 w-3.5 shrink-0 text-stone-400" />}
                  <span className="truncate">{roomLabel}</span>
                </button>
              )}

              {/* Individual accepted chats (can sit alongside a group room) */}
              {individualChats.map(({ m, r }) => (
                <button
                  key={r.id}
                  onClick={() => setActive(r)}
                  className={`flex w-full items-center gap-1.5 truncate rounded-lg px-3 py-2 text-left text-sm ${
                    active?.id === r.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="truncate">{m.to_name || "Collaborator"}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700">accepted</span>
                </button>
              ))}

              {!room && individualChats.length === 0 && (
                <p className="px-3 py-1 text-xs text-stone-400">No one has accepted yet</p>
              )}

              {/* No group room yet but people accepted individually → offer to
                  combine them into a group chat. */}
              {!room && individualChats.length > 0 && c.owned && canOwn && (
                <button
                  onClick={() => onInvite({ id: c.occasion_id, label: c.label })}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <Users className="h-3.5 w-3.5" /> Add to group chat
                </button>
              )}

              {/* Owner + Pro only: pending invitees + invite control (group
                  collabs). Individual-only collabs use "Add to group chat" above. */}
              {c.owned && canOwn && !!room && (
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
          {inert ? (
            <DemoChat
              key={active.id}
              room={active}
              memberId={memberId}
              canOwn={canOwn}
              hasGroup={rooms.some((rm) => rm.occasion_id === active.occasion_id && rm.is_group)}
            />
          ) : (
            <Chat key={active.id} room={active} memberId={memberId} isAdmin={isAdmin} canOwn={canOwn} />
          )}
        </div>
      ) : (
        <div className="card-soft flex min-w-0 items-center justify-center p-6 text-sm text-stone-400">
          {canOwn ? "Pick a chat to open, or start a collaboration." : "Pick a chat to open."}
        </div>
      )}
      </div>
    </div>
  );
}

function Chat({ room, memberId, isAdmin, canOwn = true }: { room: CollabRoom; memberId: string; isAdmin: boolean; canOwn?: boolean }) {
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
        {/* Create-event is a Pro capability — on Basic you join & chat only. */}
        {canOwn && (
          <button
            onClick={() => { if (!canCreate) return; setPlanning((p) => !p); setCreatedEventId(null); }}
            disabled={!canCreate}
            title={canCreate ? undefined : gateHint}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400 disabled:hover:bg-stone-50"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Create event
          </button>
        )}
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
