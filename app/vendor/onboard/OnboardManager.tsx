"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Check } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { ExtractedProfile } from "@/lib/onboard";
import { BUSINESS_SIZES, OWNERSHIP_TAGS } from "@/lib/business-facets";
import { ORG_FOCUS } from "@/lib/org-focus";

const TYPES = ["vendor", "artist", "organizer", "shopper", "influencer"] as const;

export function OnboardManager({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) {
  const [events, setEvents] = useState<VendorEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [tags, setTags] = useState(""); // sticky across onboards for fast batch-tagging
  const [size, setSize] = useState("");
  const [ownership, setOwnership] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [text, setText] = useState("");

  const toggleOwn = (k: string) =>
    setOwnership((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const [profile, setProfile] = useState<ExtractedProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<{ name: string; claimUrl: string } | null>(null);

  useEffect(() => {
    fetch(`/api/events/${memberId}?include_drafts=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [memberId]);

  async function extract() {
    if (text.trim().length < 10) {
      setErr("Paste a bit more from your conversation first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/onboard/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setProfile(d.profile);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to extract");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!profile?.name?.trim()) {
      setErr("Name is required.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...profile,
            businessSize: size || undefined,
            ownershipTags: ownership,
            organizerFocus: profile.memberType === "organizer" && focus ? focus : undefined,
          },
          eventId: eventId || undefined,
          mode: "organizer",
          ownerMemberId: memberId,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setCreated({ name: profile.name, claimUrl: d.claimUrl });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setText("");
    setProfile(null);
    setCreated(null);
    setErr("");
  }

  const up = (k: keyof ExtractedProfile, v: unknown) => setProfile((p) => (p ? { ...p, [k]: v } : p));

  if (created) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
          <Check className="h-5 w-5 text-white" />
        </div>
        <p className="font-semibold text-stone-900">{created.name} is onboarded</p>
        <p className="mt-1 text-sm text-stone-600">
          {eventId ? "Added to your event lineup. " : ""}Send them this link to claim & manage their page:
        </p>
        <Link href={created.claimUrl} className="mt-2 inline-block break-all text-sm font-medium text-indigo-600 hover:underline">
          {created.claimUrl}
        </Link>
        <div className="mt-4">
          <button onClick={reset} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
            Onboard another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
          <Sparkles className="h-6 w-6 text-indigo-500" /> Onboard a business
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Interview someone in person, then paste your conversation here — AI turns it into a profile you can review and publish.
        </p>
      </div>

      {!profile ? (
        <div className="card-soft space-y-3 p-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type your conversation… e.g. 'Maria runs Rosa's Tamales, a stall at the market. Sells pork & veggie tamales, $3 each. Been here 5 years, in the Mission. IG @rosastamales, phone 415-…'"
            rows={7}
            className="w-full rounded-lg border border-stone-200 p-3 text-sm"
          />
          <div className="flex items-center gap-3">
            <button onClick={extract} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy ? "Reading…" : "Extract profile"}
            </button>
            {err && <span className="text-sm text-rose-600">{err}</span>}
          </div>
        </div>
      ) : (
        <div className="card-soft space-y-3 p-5">
          <p className="section-label">Review &amp; edit</p>
          <Field label="Name"><input value={profile.name ?? ""} onChange={(e) => up("name", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
          <div className="flex gap-2">
            <Field label="Type">
              <select value={profile.memberType} onChange={(e) => up("memberType", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Category"><input value={profile.category ?? ""} onChange={(e) => up("category", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
          </div>
          {profile.memberType === "organizer" && (
            <Field label="Organizer focus">
              <select value={focus} onChange={(e) => setFocus(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <option value="">— unset —</option>
                {ORG_FOCUS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </Field>
          )}
          <div className="flex gap-2">
            <Field label="City"><input value={profile.city ?? ""} onChange={(e) => up("city", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
            <Field label="Neighborhood"><input value={profile.neighborhood ?? ""} onChange={(e) => up("neighborhood", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
          </div>
          <Field label="Description"><textarea value={profile.businessDescription ?? ""} onChange={(e) => up("businessDescription", e.target.value)} rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
          <Field label="Products (comma-separated)"><input value={profile.products?.join(", ") ?? ""} onChange={(e) => up("products", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
          <div className="flex gap-2">
            <Field label="Phone"><input value={profile.phone ?? ""} onChange={(e) => up("phone", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
            <Field label="Instagram"><input value={profile.instagramHandle ?? ""} onChange={(e) => up("instagramHandle", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
          </div>

          <Field label="Tags (comma-separated — e.g. farmers market, ghirardelli square)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="farmers market" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </Field>

          <Field label="Business size">
            <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
              <option value="">— unknown —</option>
              {BUSINESS_SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Ownership / type">
            <div className="flex flex-wrap gap-1.5">
              {OWNERSHIP_TAGS.map((o) => (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => toggleOwn(o.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${ownership.includes(o.key) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          {events.length > 0 && (
            <Field label="Add to event lineup (optional)">
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <option value="">— none —</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </Field>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={create} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? "Creating…" : "Create business"}
            </button>
            <button onClick={() => setProfile(null)} className="text-sm text-stone-500 hover:text-stone-800">Back</button>
            {err && <span className="text-sm text-rose-600">{err}</span>}
          </div>
        </div>
      )}

      <TagGroups memberId={memberId} events={events} />

      {isAdmin && <p className="text-xs text-stone-400">Acting as member {memberId}</p>}
    </div>
  );
}

function TagGroups({ memberId, events }: { memberId: string; events: VendorEvent[] }) {
  const [groups, setGroups] = useState<{ slug: string; label: string; members: { id: string; name: string | null }[] }[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});

  const load = () => {
    fetch(`/api/members/tags?memberId=${memberId}`)
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d) => setGroups(Array.isArray(d.groups) ? d.groups : []))
      .catch(() => {});
  };
  useEffect(load, [memberId]);

  async function addAll(slug: string, members: { id: string; name: string | null }[]) {
    const eventId = pick[slug];
    if (!eventId) return;
    setMsg((m) => ({ ...m, [slug]: "Adding…" }));
    const res = await fetch(`/api/vendor/events/${eventId}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitees: members.map((m) => ({ id: m.id, name: m.name })) }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg((m) => ({ ...m, [slug]: res.ok ? `Added ${d.invited ?? members.length} to lineup` : d.error || "Failed" }));
  }

  if (groups.length === 0) return null;

  return (
    <section className="card-soft p-5">
      <p className="section-label mb-3">Your tagged groups</p>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.slug} className="rounded-lg border border-stone-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-900">
                {g.label} <span className="text-stone-400">· {g.members.length}</span>
              </p>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {g.members.map((m) => (
                <a key={m.id} href={`/members/${m.id}`} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600 hover:bg-stone-200">
                  {m.name || "Member"}
                </a>
              ))}
            </div>
            {events.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={pick[g.slug] ?? ""}
                  onChange={(e) => setPick((p) => ({ ...p, [g.slug]: e.target.value }))}
                  className="rounded-lg border border-stone-200 px-2 py-1 text-xs"
                >
                  <option value="">Add all to event…</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
                <button
                  onClick={() => addAll(g.slug, g.members)}
                  disabled={!pick[g.slug]}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Add all
                </button>
                {msg[g.slug] && <span className="text-xs text-stone-500">{msg[g.slug]}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-xs text-stone-500">{label}</span>
      {children}
    </label>
  );
}
