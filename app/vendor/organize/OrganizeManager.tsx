"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Search, QrCode, Copy, Check } from "lucide-react";
import { listMembers } from "@/lib/api";
import { qrPngDataUrl } from "@/lib/qr";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import type { Member, MemberType } from "@/lib/types";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { CollabInvite } from "@/lib/collab-network";
import type { JoinRequest } from "@/lib/event-join";
import { LINEUP_ROLES, roleDef } from "@/lib/lineup-roles";
import { EventThread } from "@/components/organize/EventThread";
import { EventAttendees } from "@/components/organize/EventAttendees";
import { EventPreview } from "@/components/organize/EventPreview";

type Tab = "lineup" | "messages" | "attendees" | "preview";

export function OrganizeManager({
  memberId,
  isAdmin,
  emailReady,
  eventOrganizer = false,
}: {
  memberId: string;
  isAdmin: boolean;
  emailReady: boolean;
  eventOrganizer?: boolean;
}) {
  const [events, setEvents] = useState<VendorEvent[]>([]);
  const [selected, setSelected] = useState<VendorEvent | null>(null);
  const [tab, setTab] = useState<Tab>("lineup");

  useEffect(() => {
    fetch(`/api/events/${memberId}?include_drafts=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? (d as VendorEvent[]) : [];
        setEvents(list);
        setSelected((s) => s ?? list[0] ?? null);
      })
      .catch(() => {});
  }, [memberId]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
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
          className="shrink-0 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="card-soft p-6 text-center text-sm text-stone-400">
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
              {tab === "lineup" ? (
                <Lineup key={`l-${selected.id}`} event={selected} memberId={memberId} isAdmin={isAdmin} />
              ) : tab === "messages" ? (
                <EventThread
                  key={`m-${selected.id}`}
                  event={selected}
                  memberId={memberId}
                  isAdmin={isAdmin}
                  emailReady={emailReady}
                />
              ) : tab === "preview" ? (
                <EventPreview key={`p-${selected.id}`} event={selected} isAdmin={isAdmin} memberId={memberId} />
              ) : (
                <EventAttendees key={`a-${selected.id}`} event={selected} emailReady={emailReady} />
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const TYPE_FILTERS: { key: MemberType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vendor", label: "Vendors" },
  { key: "artist", label: "Artists" },
  { key: "organizer", label: "Community" },
];

function Lineup({ event, memberId, isAdmin }: { event: VendorEvent; memberId: string; isAdmin: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [lineup, setLineup] = useState<CollabInvite[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [type, setType] = useState<MemberType | "all">("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [role, setRole] = useState("vendor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
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

  useEffect(() => {
    listMembers({ limit: 100 })
      .then((r) => setMembers(r.members?.length ? r.members : DEMO_MEMBERS))
      .catch(() => setMembers(DEMO_MEMBERS));
  }, []);

  const invitedIds = useMemo(() => new Set(lineup.map((l) => l.to_id)), [lineup]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m.id !== memberId && !invitedIds.has(m.id))
      .filter((m) => type === "all" || m.profile?.memberType === type)
      .filter((m) => !q || (m.profile?.name || "").toLowerCase().includes(q))
      .slice(0, 40);
  }, [members, type, query, memberId, invitedIds]);

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function invite() {
    if (picked.size === 0) return;
    setBusy(true);
    setMsg("");
    const invitees = members
      .filter((m) => picked.has(m.id))
      .map((m) => ({ id: m.id, name: m.profile?.name, role }));
    try {
      const res = await fetch(`/api/vendor/events/${event.id}/lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitees, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg(`Invited ${d.invited} ${roleDef(role).label.toLowerCase()}${d.invited === 1 ? "" : "s"}.`);
      setPicked(new Set());
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
      {/* Find vendors */}
      <div>
        <p className="section-label mb-3">Add to lineup</p>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors…"
            className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                type === t.key ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-stone-100 p-1">
          {results.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
            >
              <input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m.id)} className="accent-indigo-600" />
              <span className="min-w-0 flex-1 truncate">{m.profile?.name || "Member"}</span>
              <span className="shrink-0 text-xs text-stone-400">{m.profile?.memberType}</span>
            </label>
          ))}
          {results.length === 0 && <p className="px-2 py-3 text-sm text-stone-400">No vendors found.</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-stone-500">as</label>
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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
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

