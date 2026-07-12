"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Check, X, Search } from "lucide-react";
import { listMembers } from "@/lib/api";
import { readServes, focusLabel } from "@/lib/org-focus";
import { KIND_LABEL, type Contribution, type ContributionKind } from "@/lib/contributions";
import type { Member } from "@/lib/types";

const KINDS: ContributionKind[] = ["goods", "funds", "time", "other"];

// Sample community orgs for the search dropdown. Used as a fallback when the
// directory returns nothing (e.g. the Admin demo, which has no real backend),
// so the org picker is explorable instead of empty.
const DEMO_ORGS: Member[] = [
  { id: "demo-org-food-bank", profile: { name: "SF-Marin Food Bank", serves: ["individuals"] } },
  { id: "demo-org-glide", profile: { name: "GLIDE Community Center", serves: ["individuals"] } },
  { id: "demo-org-la-cocina", profile: { name: "La Cocina Kitchen Incubator", serves: ["small-businesses"] } },
  { id: "demo-org-meda", profile: { name: "MEDA (Mission Economic Development)", serves: ["small-businesses"] } },
  { id: "demo-org-mutual-aid", profile: { name: "Mission Mutual Aid", serves: ["individuals"] } },
  { id: "demo-org-hamilton", profile: { name: "Hamilton Families", serves: ["individuals"] } },
  { id: "demo-org-renaissance", profile: { name: "Renaissance Entrepreneurship Center", serves: ["small-businesses"] } },
  { id: "demo-org-larkin", profile: { name: "Larkin Street Youth Services", serves: ["individuals"] } },
];

export function GivingManager({
  memberId,
  memberName,
  isAdmin,
}: {
  memberId: string;
  memberName: string;
  isAdmin: boolean;
}) {
  const [outgoing, setOutgoing] = useState<Contribution[]>([]);
  const [incoming, setIncoming] = useState<Contribution[]>([]);
  const [orgs, setOrgs] = useState<Member[]>([]);

  // form
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState<Member | null>(null);
  const [kind, setKind] = useState<ContributionKind>("goods");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [focused, setFocused] = useState(false);

  const qp = isAdmin ? `?memberId=${memberId}` : "";

  const load = () => {
    fetch(`/api/vendor/contributions${qp}`)
      .then((r) => (r.ok ? r.json() : { outgoing: [], incoming: [] }))
      .then((d) => {
        setOutgoing(Array.isArray(d.outgoing) ? d.outgoing : []);
        setIncoming(Array.isArray(d.incoming) ? d.incoming : []);
      })
      .catch(() => {});
  };

  useEffect(load, [qp]);

  useEffect(() => {
    listMembers({ type: "organizer", limit: 100 })
      .then((r) => setOrgs(r.members?.length ? r.members : DEMO_ORGS))
      .catch(() => setOrgs(DEMO_ORGS));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    // With no query, still surface a few orgs so the dropdown is discoverable.
    const pool = q
      ? orgs.filter((m) => (m.profile?.name || "").toLowerCase().includes(q))
      : orgs;
    return pool.slice(0, 6);
  }, [query, orgs]);

  async function submit() {
    if (!org || !description.trim()) {
      setMsg("Pick an org and describe the gift.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/vendor/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: isAdmin ? memberId : undefined,
          orgId: org.id,
          orgName: org.profile?.name,
          kind,
          description: description.trim(),
          amountCents: kind === "funds" && amount ? Math.round(Number(amount) * 100) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg("Logged — pending the org's confirmation.");
      setOrg(null);
      setQuery("");
      setDescription("");
      setAmount("");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to log gift");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(id: string, status: "confirmed" | "declined") {
    await fetch("/api/vendor/contributions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, memberId: isAdmin ? memberId : undefined }),
    });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
          <Heart className="h-6 w-6 text-rose-500" /> Community giving
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Log what {memberName} gives to local orgs — funds, goods, time, anything. Once the org
          confirms, it shows as a <b>Gives back</b> badge on your profile.
        </p>
      </div>

      {/* Log a gift */}
      <section className="card-soft p-4">
        <p className="section-label mb-3">Log a gift</p>

        {/* Org picker */}
        {org ? (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2">
            <div>
              <span className="text-sm font-medium text-stone-900">{org.profile?.name}</span>
              {readServes(org.profile).length > 0 && (
                <span className="ml-2 text-xs text-teal-700">
                  serves {readServes(org.profile).map(focusLabel).join(", ")}
                </span>
              )}
            </div>
            <button onClick={() => setOrg(null)} className="text-stone-400 hover:text-stone-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Search a community org…"
              className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"
            />
            {focused && matches.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        setOrg(m);
                        setQuery("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"
                    >
                      <span className="font-medium text-stone-900">{m.profile?.name}</span>
                      {readServes(m.profile).length > 0 && (
                        <span className="text-xs text-teal-600">
                          {readServes(m.profile).map(focusLabel).join(", ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Kind */}
        <div className="mb-3 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                kind === k ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you give? e.g. 50 loaves of bread weekly, volunteer staff for the food drive…"
          rows={2}
          className="mb-3 w-full rounded-lg border border-stone-200 p-3 text-sm"
        />

        {kind === "funds" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-stone-500">Amount (optional, USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="w-40 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-rose-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Logging…" : "Log gift"}
          </button>
          {msg && <span className="text-sm text-stone-500">{msg}</span>}
        </div>
      </section>

      {/* Org inbox — gifts to confirm */}
      {incoming.length > 0 && (
        <section className="card-soft p-4">
          <p className="section-label mb-3">Gifts to confirm ({incoming.length})</p>
          <p className="mb-3 text-xs text-stone-500">
            Businesses say they gave to your org. Confirm so they earn public credit.
          </p>
          <ul className="space-y-3">
            {incoming.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{c.vendor_name || "A business"}</p>
                  <p className="truncate text-sm text-stone-600">
                    <span className="text-stone-400">{KIND_LABEL[c.kind]} · </span>
                    {c.description}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => confirm(c.id, "confirmed")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" /> Confirm
                  </button>
                  <button
                    onClick={() => confirm(c.id, "declined")}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Your giving */}
      <section className="card-soft p-4">
        <p className="section-label mb-3">Your giving</p>
        {outgoing.length === 0 ? (
          <p className="text-sm text-stone-400">No gifts logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {outgoing.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-stone-800">
                    <span className="text-stone-400">{KIND_LABEL[c.kind]} · </span>
                    {c.description}
                  </p>
                  <p className="text-xs text-stone-400">to {c.org_name || "an org"}</p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: Contribution["status"] }) {
  const map = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    declined: "bg-stone-200 text-stone-500",
  } as const;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}
