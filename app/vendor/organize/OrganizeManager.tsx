"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, QrCode, Copy, Check, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { qrPngDataUrl } from "@/lib/qr";
import type { MatchCandidate } from "@/lib/types";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { CollabInvite } from "@/lib/collab-network";
import type { JoinRequest } from "@/lib/event-join";
import { LINEUP_ROLES, roleDef, inferRole } from "@/lib/lineup-roles";
import { PeoplePicker } from "@/components/match/PeoplePicker";
import { AutoFillLineup } from "@/components/organize/AutoFillLineup";
import { EventThread } from "@/components/organize/EventThread";
import { EventAttendees } from "@/components/organize/EventAttendees";
import { EventPreview } from "@/components/organize/EventPreview";

type Tab = "lineup" | "messages" | "attendees" | "preview";

// Illustrative events for the Admin demo (no real backend).
const DEMO_EVENTS: VendorEvent[] = [
  {
    id: "demo-ev-block", member_id: "", member_name: "You", title: "Summer Block Party",
    description: "Food trucks, live music, and a kids' zone on the block.", event_date: "2026-08-15",
    event_time: "2:00 PM – 8:00 PM", location: "Valencia St", city: "San Francisco", neighborhood: "Mission",
    lat: 37.7599, lng: -122.4214,
    poster_image_url: null, capacity: 300, source: "manual", active: true, created_at: "2026-06-20T15:00:00.000Z",
  },
  {
    id: "demo-ev-market", member_id: "", member_name: "You", title: "Neighborhood Night Market",
    description: "Local makers, food stalls, and a live mural wall.", event_date: "2026-07-25",
    event_time: "6:00 PM – 10:00 PM", location: "Dolores Park", city: "San Francisco", neighborhood: "Mission",
    lat: 37.7596, lng: -122.4269,
    poster_image_url: null, capacity: null, source: "manual", active: true, created_at: "2026-06-24T15:00:00.000Z",
  },
];

export function OrganizeManager({
  memberId,
  isAdmin,
  emailReady,
  eventOrganizer = false,
  demo = false,
  intro,
}: {
  memberId: string;
  isAdmin: boolean;
  emailReady: boolean;
  eventOrganizer?: boolean;
  demo?: boolean;
  // Page-level preamble (e.g. the public /organizers pitch). Rendered ONLY on
  // the events list — once you're inside an event, the tool is the point and a
  // marketing header just pushes it down the screen.
  intro?: React.ReactNode;
}) {
  const [events, setEvents] = useState<VendorEvent[]>([]);
  const [selected, setSelected] = useState<VendorEvent | null>(null);
  const [tab, setTab] = useState<Tab>("lineup");

  // No auto-select: you land on your events and open one, the same way
  // Collaborations works. ?event=<id> (e.g. straight after creating one) opens
  // it directly.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("event");
    const open = (list: VendorEvent[]) => {
      setEvents(list);
      if (wanted) setSelected(list.find((e) => e.id === wanted) ?? null);
    };
    if (demo) {
      open(DEMO_EVENTS);
      return;
    }
    fetch(`/api/events/${memberId}?include_drafts=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => open(Array.isArray(d) ? (d as VendorEvent[]) : []))
      .catch(() => {});
  }, [memberId, demo]);

  // ── List: your events, newest first, with "New event" at the top. ──────────
  if (!selected) {
    return (
      <div className="space-y-4">
        {intro}
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
            <CalendarPlus className="h-6 w-6 shrink-0 text-indigo-500" />
            {eventOrganizer ? "Organize festival" : "Organize"}
            {eventOrganizer && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Public events</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-stone-500">Your lineup, your people, one thread.</p>
        </div>

        {/* Always shown — it's the primary action of the page. (It used to be
            hidden whenever `demo` was on, which meant it never appeared in the
            admin demo OR the public preview.) */}
        <Link href="/vendor/event/new" className="card-soft card-hover flex w-full items-center gap-3 p-4 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50">
            <Plus className="h-4 w-4 text-indigo-600" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-stone-900">Create new event</span>
            <span className="mt-0.5 block truncate text-xs text-stone-500">
              Start a lineup and invite your people
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>

        {events.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">
            No events yet — create one to start building a lineup.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="section-label px-1">Your events</p>
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="card-soft card-hover flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
                  <CalendarPlus className="h-4 w-4 text-stone-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-900">{e.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-stone-500">
                    {[e.event_date, e.event_time].filter(Boolean).join(" · ") || "No date"}
                    {e.location ? ` · ${e.location}` : ""}
                  </span>
                </span>
                {!e.active && (
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    Draft
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Detail: the open event becomes the title, with its tabs beneath. ───────
  return (
    <div className="space-y-4">
      <button
        onClick={() => setSelected(null)}
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Events
      </button>

      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
          {selected.title}
          {!selected.active && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">Draft</span>
          )}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {[selected.event_date, selected.event_time, selected.location].filter(Boolean).join(" · ") || "No date set"}
        </p>
      </div>

      <div>
              <div className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([
                  ["lineup", "Lineup"],
                  ["messages", "Messages"],
                  ["attendees", "Attendees"],
                  ["preview", "Event page"],
                ] as [Tab, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-medium ${
                      tab === k
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "lineup" ? (
                <Lineup key={`l-${selected.id}`} event={selected} memberId={memberId} isAdmin={isAdmin} demo={demo} />
              ) : tab === "messages" ? (
                <EventThread
                  key={`m-${selected.id}`}
                  event={selected}
                  memberId={memberId}
                  isAdmin={isAdmin}
                  emailReady={emailReady}
                  demo={demo}
                />
              ) : tab === "preview" ? (
                <EventPreview key={`p-${selected.id}`} event={selected} isAdmin={isAdmin} memberId={memberId} />
              ) : (
                <EventAttendees key={`a-${selected.id}`} event={selected} emailReady={emailReady} demo={demo} />
              )}
      </div>
    </div>
  );
}

function demoLineup(eventId: string): CollabInvite[] {
  const base = { from_id: "", from_name: "You", to_id: "", message: null, status: "accepted" as const, room_id: null, scope_type: "event" as const, scope_id: eventId, occasion_id: eventId, occasion_label: null, created_at: "2026-06-24T15:00:00.000Z" };
  return [
    { ...base, id: "demo-l-1", to_name: "Nokku Coffee", role: "vendor" },
    { ...base, id: "demo-l-2", to_name: "Dani Cruz", role: "performer" },
    { ...base, id: "demo-l-3", to_name: "El Tri Cantina", role: "food" },
    { ...base, id: "demo-l-4", to_name: "Greenhouse Project", role: "partner" },
    { ...base, id: "demo-l-5", to_name: "Rosa's Tamales", role: "food" },
    { ...base, id: "demo-l-6", to_name: "Bayview Bike Co-op", role: "volunteer" },
    // A self-join (from_id === to_id) awaiting the organizer's approval — the
    // QR-at-the-booth flow, which is the bit organizers care about.
    { ...base, id: "demo-l-7", to_name: "Studio Nine", role: "vendor", status: "pending", from_id: "x", to_id: "x" },
  ];
}

// Businesses that scanned the join QR but aren't in the directory yet.
function demoRequests(eventId: string): JoinRequest[] {
  const base = { event_id: eventId, status: "pending" as const, created_at: "2026-07-02T15:00:00.000Z" };
  return [
    { ...base, id: "demo-r-1", name: "Auntie's Lumpia Cart", category: "Food", contact: "(415) 555-0173", note: "Been at the market 3 years, first time on the app." },
    { ...base, id: "demo-r-2", name: "Kite & String Ceramics", category: "Maker", contact: "hello@kiteandstring.example", note: null },
  ];
}

function Lineup({ event, memberId, isAdmin, demo }: { event: VendorEvent; memberId: string; isAdmin: boolean; demo?: boolean }) {
  const [lineup, setLineup] = useState<CollabInvite[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map());
  const [role, setRole] = useState("vendor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Adding is its own view, not another block on the pile. The lineup tab was
  // ~7 phone screens of everything-at-once, with the search buried under the
  // whole roster — so this page is the roster, and adding is an action.
  const [adding, setAdding] = useState(false);
  // Tap a role chip to see just those people; tap it again to clear.
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const load = () => {
    if (demo) {
      setLineup(demoLineup(event.id));
      setRequests(demoRequests(event.id));
      return;
    }
    fetch(`/api/vendor/events/${event.id}/lineup`)
      .then((r) => (r.ok ? r.json() : { lineup: [] }))
      .then((d) => setLineup(Array.isArray(d.lineup) ? d.lineup : []))
      .catch(() => {});
    fetch(`/api/vendor/events/${event.id}/requests`)
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => setRequests(Array.isArray(d.requests) ? d.requests : []))
      .catch(() => {});
  };
  useEffect(load, [event.id]);

  // In demo, actions apply LOCALLY so the flow is real to click through — the
  // approve/decline/invite buttons do what they'd do, they just never persist.
  async function decide(id: string, status: "accepted" | "declined") {
    if (demo) {
      setLineup((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
      return;
    }
    await fetch(`/api/vendor/events/${event.id}/lineup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, memberId: isAdmin ? memberId : undefined }),
    });
    load();
  }
  async function resolveRequest(id: string, status: "added" | "dismissed") {
    if (demo) {
      setRequests((rs) => rs.filter((r) => r.id !== id));
      return;
    }
    await fetch(`/api/vendor/events/${event.id}/requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, memberId: isAdmin ? memberId : undefined }),
    });
    load();
  }

  const invitedIds = useMemo(() => new Set(lineup.map((l) => l.to_id)), [lineup]);

  function toggle(c: MatchCandidate) {
    setPicked((s) => {
      const n = new Map(s);
      if (n.has(c.id)) n.delete(c.id);
      else n.set(c.id, c);
      return n;
    });
  }

  async function invite() {
    if (picked.size === 0) return;
    setBusy(true);
    setMsg("");
    // Role comes from who they already are — no "invite as" step to answer.
    const invitees = [...picked.values()].map((c) => ({ id: c.id, name: c.name, role: inferRole(c) }));
    if (demo) {
      setLineup((ls) => [
        ...ls,
        ...invitees.map((v, i) => ({
          id: `demo-new-${v.id}-${i}`, from_id: "", from_name: "You", to_id: v.id, to_name: v.name,
          message: null, status: "pending" as const, room_id: null, scope_type: "event" as const,
          scope_id: event.id, occasion_id: event.id, occasion_label: null, role: v.role,
          created_at: new Date().toISOString(),
        })),
      ]);
      setMsg(`Invited ${invitees.length} — they'd get an SMS + in-app invite.`);
      setPicked(new Map());
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/vendor/events/${event.id}/lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitees, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg(`Invited ${d.invited} to the lineup.`);
      setPicked(new Map());
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  // Who's participating and where they stand — the same three-state split as the
  // collaboration Participants tab, with the one state only an event has:
  // "asked to join" (they scanned the booth QR, so it's waiting on YOU, not them).
  const isSelfJoin = (l: CollabInvite) => l.from_id === l.to_id;
  const inLineup = lineup.filter((l) => l.status === "accepted");
  const askedToJoin = lineup.filter((l) => l.status === "pending" && isSelfJoin(l));
  const invited = lineup.filter((l) => l.status === "pending" && !isSelfJoin(l));
  const declinedList = lineup.filter((l) => l.status === "declined");

  // The role chips double as a filter: tap "Food truck" to see just the food.
  const inRole = (l: CollabInvite) => !roleFilter || (l.role ?? "vendor") === roleFilter;
  const PARTICIPANT_GROUPS = [
    { key: "in", label: "In", hint: "On the lineup — confirmed.", items: inLineup.filter(inRole), act: false },
    {
      key: "asked",
      label: "Asked to join",
      hint: "Scanned your QR at the booth — approve to add them.",
      items: askedToJoin.filter(inRole),
      act: true,
    },
    { key: "invited", label: "Invited", hint: "Waiting on their answer.", items: invited.filter(inRole), act: false },
    { key: "declined", label: "Declined", hint: "Said no thanks.", items: declinedList.filter(inRole), act: false },
  ] as const;
  const shownCount = PARTICIPANT_GROUPS.reduce((n, g) => n + g.items.length, 0);

  // A compact role summary — the festival's shape, without a whole card for it.
  const active = [...inLineup, ...askedToJoin, ...invited];
  const byRole = LINEUP_ROLES.map((r) => ({
    role: r,
    items: active.filter((l) => (l.role ?? "vendor") === r.key),
  })).filter((g) => g.items.length > 0);

  // ── Add view: search, pick a role, invite. One job per screen. ─────────────
  if (adding) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setAdding(false)}
            className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="h-4 w-4" /> Lineup
          </button>
          {/* AI auto-fill calls the live matcher (authed) — not on the public demo. */}
          {!demo && (
            <AutoFillLineup
              eventId={event.id}
              hint={[event.title, event.description, event.location].filter(Boolean).join(". ")}
              memberId={memberId}
              isAdmin={isAdmin}
              invitedIds={invitedIds}
              onInvited={load}
            />
          )}
        </div>

        <PeoplePicker
          memberId={memberId}
          isAdmin={isAdmin}
          demo={demo}
          picked={picked}
          onToggle={toggle}
          sentIds={invitedIds}
          sentLabel="In lineup"
          excludeIds={new Set([memberId])}
          placeholder="Search — “taco truck”, “muralist”, “live band”…"
          emptyHint="Search to add vendors, performers, sponsors…"
        />

        {/* No "invite as" step — the role is inferred from what each business
            already is (a taquería is food, a muralist performs). */}
        {picked.size > 0 && (
          <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap gap-1.5">
              {[...picked.values()].map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600"
                >
                  {roleDef(inferRole(c)).emoji} {c.name}
                </span>
              ))}
            </div>
            <button
              onClick={invite}
              disabled={busy}
              className="w-full rounded-xl bg-indigo-600 px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
            >
              {busy ? "Inviting…" : `Invite ${picked.size} to the lineup`}
            </button>
          </div>
        )}
        {msg && <p className="text-[13px] text-stone-500">{msg}</p>}
      </div>
    );
  }

  return (
   <div className="space-y-6">
    {/* Participants first: who's taking part and exactly where each one stands.
        Same three-state read as the collaboration Participants tab. */}
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="section-label">
          Participants · {shownCount}
          {roleFilter && <span className="font-normal normal-case text-stone-400"> of {lineup.length}</span>}
        </p>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-stone-800"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* The festival's shape in one line — and the filter. Tap a role to see
          just the food trucks / performers / sponsors; tap again to clear. */}
      {byRole.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {roleFilter && (
            <button
              onClick={() => setRoleFilter(null)}
              className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-stone-800"
            >
              <X className="h-3 w-3" /> All
            </button>
          )}
          {byRole.map((g) => {
            const on = roleFilter === g.role.key;
            return (
              <button
                key={g.role.key}
                onClick={() => setRoleFilter(on ? null : g.role.key)}
                aria-pressed={on}
                className={
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition " +
                  (on
                    ? "bg-indigo-600 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900")
                }
              >
                {g.role.emoji} {g.items.length} {g.role.label}
              </button>
            );
          })}
        </div>
      )}

      {lineup.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-400">
          Nobody yet — tap Add to build your lineup.
        </p>
      ) : (
        <div className="space-y-5">
          {PARTICIPANT_GROUPS.filter((g) => g.items.length > 0).map((g) => (
            <div key={g.key}>
              <p className="section-label mb-1">
                {g.label} · {g.items.length}
              </p>
              <p className="mb-2 text-[11px] text-stone-400">{g.hint}</p>
              <ul className="space-y-1.5">
                {g.items.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-100 text-sm"
                      title={roleDef(l.role).label}
                    >
                      {roleDef(l.role).emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/members/${l.to_id}`}
                        className="block truncate text-sm font-medium text-stone-900 hover:text-indigo-700"
                      >
                        {l.to_name || "Member"}
                      </Link>
                      <span className="mt-0.5 block truncate text-[11px] text-stone-500">
                        {roleDef(l.role).label}
                      </span>
                    </span>
                    {g.act ? (
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => decide(l.id, "accepted")}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decide(l.id, "declined")}
                          className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200"
                        >
                          Decline
                        </button>
                      </span>
                    ) : (
                      <LineupStateChip state={g.key} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* "New business requests" (vendors not in the directory) is deliberately
        NOT rendered. Participating means having an account — that's the point of
        the directory — so a business that isn't on the app signs up rather than
        getting hand-added by an organizer. It isn't the organizer's job to do
        data entry for someone else's business. The table + API stay put so this
        can come back if that assumption ever breaks. */}

    {/* The booth QR: useful, but it isn't what you open this page for — so it
        sits at the bottom rather than above your lineup. */}
    <JoinLink eventId={event.id} />
   </div>
  );
}

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://whatslocal.ai").replace(/\/$/, "");

function JoinLink({ eventId }: { eventId: string }) {
  const url = `${SITE_ORIGIN}/onboard?event=${eventId}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    qrPngDataUrl(url, { size: 320 }).then(setQr).catch(() => {});
  }, [url]);

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <section className="card-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label mb-1 flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5" /> Vendor join link
          </p>
          {/* Wraps on mobile — truncating this to one line lost the point of it. */}
          <p className="text-sm leading-snug text-stone-500">
            Print the QR at your market — vendors scan, chat to set up their profile, and land in your lineup for approval.
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-sm font-medium text-indigo-600 hover:underline">
          {open ? "Hide" : "Show QR"}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600" />
        <button onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-800">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {open && qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Vendor join QR code" className="mt-3 h-40 w-40 rounded-lg border border-stone-100 sm:h-48 sm:w-48" />
      )}
    </section>
  );
}

// Reads as the participant's STATE, not a database status. (It used to print the
// raw column value — "accepted" / "pending" — which told an organizer nothing
// about whether the ball was in their court.)
function LineupStateChip({ state }: { state: "in" | "asked" | "invited" | "declined" }) {
  const map = {
    in: { label: "👍 In", cls: "bg-emerald-50 text-emerald-700" },
    asked: { label: "Asked", cls: "bg-indigo-50 text-indigo-700" },
    invited: { label: "Invited", cls: "bg-amber-50 text-amber-700" },
    declined: { label: "Declined", cls: "bg-stone-100 text-stone-500" },
  }[state];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${map.cls}`}>{map.label}</span>;
}

