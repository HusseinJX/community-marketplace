"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, QrCode, Copy, Check } from "lucide-react";
import { qrPngDataUrl } from "@/lib/qr";
import type { MatchCandidate } from "@/lib/types";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { CollabInvite } from "@/lib/collab-network";
import type { JoinRequest } from "@/lib/event-join";
import { LINEUP_ROLES, roleDef } from "@/lib/lineup-roles";
import { MatchFinder } from "@/components/match/MatchFinder";
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
}: {
  memberId: string;
  isAdmin: boolean;
  emailReady: boolean;
  eventOrganizer?: boolean;
  demo?: boolean;
}) {
  const [events, setEvents] = useState<VendorEvent[]>([]);
  const [selected, setSelected] = useState<VendorEvent | null>(null);
  const [tab, setTab] = useState<Tab>("lineup");

  useEffect(() => {
    if (demo) {
      setEvents(DEMO_EVENTS);
      setSelected((s) => s ?? DEMO_EVENTS[0] ?? null);
      return;
    }
    fetch(`/api/events/${memberId}?include_drafts=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? (d as VendorEvent[]) : [];
        setEvents(list);
        setSelected((s) => s ?? list[0] ?? null);
      })
      .catch(() => {});
  }, [memberId, demo]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
            <CalendarPlus className="h-6 w-6 text-indigo-500" />
            {eventOrganizer ? "Organize festival" : "Organize"}
            {eventOrganizer && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Public events</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {eventOrganizer
              ? "Build a multi-role lineup — vendors, performers, sponsors, volunteers — and keep everyone in the loop via in-app, SMS, and email."
              : "Build a vendor lineup and keep everyone in the loop — in-app, SMS, and email."}
          </p>
        </div>
        <Link
          href="/vendor/events"
          className="shrink-0 rounded-lg bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800"
        >
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="card-soft p-4 text-center text-sm text-stone-400">
          No events yet.{" "}
          <Link href="/vendor/events" className="font-medium text-indigo-600 hover:underline">
            Create your first event
          </Link>{" "}
          to start building a lineup.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <ul className="space-y-1">
            {events.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSelected(e)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selected?.id === e.id
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <span className="block truncate">{e.title}</span>
                  <span className="block truncate text-xs text-stone-400">
                    {[e.event_date, e.event_time].filter(Boolean).join(" · ") || "No date"}
                    {!e.active && " · draft"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div>
              <div className="mb-4 flex gap-1 border-b border-stone-200">
                {([
                  ["lineup", "Lineup"],
                  ["messages", "Messages"],
                  ["attendees", "Attendees"],
                  ["preview", "Event page"],
                ] as [Tab, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] font-medium ${
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
          ) : null}
        </div>
      )}
    </div>
  );
}

function demoLineup(eventId: string): CollabInvite[] {
  const base = { from_id: "", from_name: "You", to_id: "", message: null, status: "accepted" as const, room_id: null, scope_type: "event" as const, scope_id: eventId, occasion_id: eventId, occasion_label: null, created_at: "2026-06-24T15:00:00.000Z" };
  return [
    { ...base, id: "demo-l-1", to_name: "Nokku Coffee", role: "vendor" },
    { ...base, id: "demo-l-2", to_name: "Dani Cruz", role: "performer" },
    { ...base, id: "demo-l-3", to_name: "El Tri Cantina", role: "food" },
    { ...base, id: "demo-l-4", to_name: "Studio Nine", role: "vendor", status: "pending" },
  ];
}

function Lineup({ event, memberId, isAdmin, demo }: { event: VendorEvent; memberId: string; isAdmin: boolean; demo?: boolean }) {
  const [lineup, setLineup] = useState<CollabInvite[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map());
  const [role, setRole] = useState("vendor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    if (demo) {
      setLineup(demoLineup(event.id));
      setRequests([]);
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

  async function decide(id: string, status: "accepted" | "declined") {
    await fetch(`/api/vendor/events/${event.id}/lineup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, memberId: isAdmin ? memberId : undefined }),
    });
    load();
  }
  async function resolveRequest(id: string, status: "added" | "dismissed") {
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
    const invitees = [...picked.values()].map((c) => ({ id: c.id, name: c.name, role }));
    try {
      const res = await fetch(`/api/vendor/events/${event.id}/lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitees, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg(`Invited ${d.invited} ${roleDef(role).label.toLowerCase()}${d.invited === 1 ? "" : "s"}.`);
      setPicked(new Map());
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  const byStatus = (s: string) => lineup.filter((l) => l.status === s);

  return (
   <div className="space-y-6">
    <JoinLink eventId={event.id} />

    {requests.length > 0 && (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="section-label mb-2 text-amber-800">New business requests ({requests.length})</p>
        <p className="mb-3 text-xs text-amber-700">
          Vendors not yet in the directory. Add them in the connector, then mark added.
        </p>
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">{r.name}</p>
                <p className="truncate text-xs text-stone-500">
                  {[r.category, r.contact].filter(Boolean).join(" · ")}
                  {r.note ? ` — ${r.note}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 gap-1.5">
                <button onClick={() => resolveRequest(r.id, "added")} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                  Added
                </button>
                <button onClick={() => resolveRequest(r.id, "dismissed")} className="rounded-md bg-stone-200 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-300">
                  Dismiss
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    )}

    <div className="grid gap-5 lg:grid-cols-2">
      {/* Find vendors — semantic search + AI auto-fill */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="section-label">Add to lineup</p>
          <AutoFillLineup
            eventId={event.id}
            hint={[event.title, event.description, event.location].filter(Boolean).join(". ")}
            memberId={memberId}
            isAdmin={isAdmin}
            invitedIds={invitedIds}
            onInvited={load}
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-stone-100 p-2">
          <MatchFinder
            memberId={memberId}
            isAdmin={isAdmin}
            showForYou={false}
            placeholder="Try “taco truck”, “muralist”, “live band”…"
            selected={new Set(picked.keys())}
            onToggle={toggle}
            sentIds={invitedIds}
            excludeIds={new Set([memberId])}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-stone-500">Invite selected as</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-stone-200 px-2 py-2 text-sm"
          >
            {LINEUP_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.emoji} {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={invite}
            disabled={busy || picked.size === 0}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
          >
            {busy ? "Inviting…" : `Invite ${picked.size || ""}`.trim()}
          </button>
          {msg && <span className="text-sm text-stone-500">{msg}</span>}
        </div>
      </div>

      {/* Current lineup */}
      <div>
        <p className="section-label mb-3">Lineup</p>
        {lineup.length === 0 ? (
          <p className="text-sm text-stone-400">No invites yet. Pick vendors and send.</p>
        ) : (
          <div className="space-y-4">
            {(["accepted", "pending", "declined"] as const).map((s) =>
              byStatus(s).length === 0 ? null : (
                <div key={s}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
                    {s} ({byStatus(s).length})
                  </p>
                  <ul className="space-y-1">
                    {byStatus(s).map((l) => {
                      const selfJoin = l.from_id === l.to_id;
                      return (
                        <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
                          <Link href={`/members/${l.to_id}`} className="flex min-w-0 items-center gap-1.5 truncate text-stone-800 hover:text-indigo-700">
                            <span className="shrink-0" title={roleDef(l.role).label}>{roleDef(l.role).emoji}</span>
                            <span className="truncate">{l.to_name || "Member"}</span>
                            {selfJoin && s === "pending" && (
                              <span className="ml-1.5 shrink-0 text-xs text-indigo-500">· requested to join</span>
                            )}
                          </Link>
                          {s === "pending" && selfJoin ? (
                            <span className="flex shrink-0 gap-1.5">
                              <button onClick={() => decide(l.id, "accepted")} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                                Approve
                              </button>
                              <button onClick={() => decide(l.id, "declined")} className="rounded-md bg-stone-200 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-300">
                                Decline
                              </button>
                            </span>
                          ) : (
                            <StatusDot status={l.status} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label mb-1 flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5" /> Vendor join link
          </p>
          <p className="truncate text-sm text-stone-500">
            Print the QR at your market — vendors scan, chat to set up their profile, and land in your lineup for approval.
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-sm font-medium text-indigo-600 hover:underline">
          {open ? "Hide" : "Show QR"}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input readOnly value={url} className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600" />
        <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-800">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {open && qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Vendor join QR code" className="mt-3 h-48 w-48 rounded-lg border border-stone-100" />
      )}
    </section>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    accepted: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    declined: "bg-stone-200 text-stone-500",
  };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}

