"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, UserPlus, FileText, Search, Check, Package, Calendar, ExternalLink } from "lucide-react";
import { OnboardManager } from "../onboard/OnboardManager";
import { ORG_FOCUS } from "@/lib/org-focus";

const TYPES = ["vendor", "artist", "organizer", "shopper", "influencer"] as const;

type Tab = "create" | "transcript" | "behalf";

export function AdminPanel({ ownerMemberId }: { ownerMemberId: string }) {
  const [tab, setTab] = useState<Tab>("create");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
          <Shield className="h-6 w-6 text-indigo-500" /> Super-admin
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Create profiles, onboard from a conversation, and add events/products on behalf of any business — even ones that haven&apos;t signed up.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "create"} onClick={() => setTab("create")} icon={UserPlus} label="Create profile" />
        <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")} icon={FileText} label="Add by transcript" />
        <TabButton active={tab === "behalf"} onClick={() => setTab("behalf")} icon={Search} label="Act on behalf" />
      </div>

      {tab === "create" && <CreateProfile ownerMemberId={ownerMemberId} />}
      {tab === "transcript" && <OnboardManager memberId={ownerMemberId} isAdmin />}
      {tab === "behalf" && <ActOnBehalf />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Shield; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ── Create a basic profile (name / bio / tags) ──────────────────────────────
function CreateProfile({ ownerMemberId }: { ownerMemberId: string }) {
  const [form, setForm] = useState({
    name: "",
    memberType: "vendor" as (typeof TYPES)[number],
    category: "",
    city: "",
    neighborhood: "",
    businessDescription: "",
    instagramHandle: "",
    phone: "",
    websiteUrl: "",
    organizerFocus: "",
  });
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<{ name: string; memberId: string; claimUrl: string } | null>(null);

  const up = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    if (!form.name.trim()) {
      setErr("A name is required.");
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
            name: form.name.trim(),
            memberType: form.memberType,
            category: form.category || undefined,
            city: form.city || undefined,
            neighborhood: form.neighborhood || undefined,
            businessDescription: form.businessDescription || undefined,
            instagramHandle: form.instagramHandle || undefined,
            phone: form.phone || undefined,
            websiteUrl: form.websiteUrl || undefined,
            organizerFocus: form.memberType === "organizer" && form.organizerFocus ? form.organizerFocus : undefined,
          },
          mode: "organizer",
          ownerMemberId,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setCreated({ name: form.name.trim(), memberId: d.memberId, claimUrl: d.claimUrl });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm({ name: "", memberType: "vendor", category: "", city: "", neighborhood: "", businessDescription: "", instagramHandle: "", phone: "", websiteUrl: "", organizerFocus: "" });
    setTags("");
    setCreated(null);
    setErr("");
  }

  if (created) return <CreatedCard created={created} onReset={reset} resetLabel="Create another" />;

  return (
    <div className="card-soft space-y-3 p-5">
      <p className="section-label">Basic profile</p>
      <Field label="Name *"><input value={form.name} onChange={(e) => up("name", e.target.value)} placeholder="Rosa's Tamales" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
      <div className="flex gap-2">
        <Field label="Type">
          <select value={form.memberType} onChange={(e) => up("memberType", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Category"><input value={form.category} onChange={(e) => up("category", e.target.value)} placeholder="Food & Drink" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
      </div>
      {form.memberType === "organizer" && (
        <Field label="Organizer focus">
          <select value={form.organizerFocus} onChange={(e) => up("organizerFocus", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <option value="">— unset —</option>
            {ORG_FOCUS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
      )}
      <div className="flex gap-2">
        <Field label="City"><input value={form.city} onChange={(e) => up("city", e.target.value)} placeholder="San Francisco" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
        <Field label="Neighborhood"><input value={form.neighborhood} onChange={(e) => up("neighborhood", e.target.value)} placeholder="Mission" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
      </div>
      <Field label="Bio / description"><textarea value={form.businessDescription} onChange={(e) => up("businessDescription", e.target.value)} rows={2} placeholder="A short line about who they are and what they do." className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
      <div className="flex gap-2">
        <Field label="Instagram"><input value={form.instagramHandle} onChange={(e) => up("instagramHandle", e.target.value)} placeholder="rosastamales" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(e) => up("phone", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
      </div>
      <Field label="Website"><input value={form.websiteUrl} onChange={(e) => up("websiteUrl", e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>
      <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="farmers market, sf library" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={create} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Creating…" : "Create profile"}
        </button>
        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>
    </div>
  );
}

function CreatedCard({ created, onReset, resetLabel }: { created: { name: string; memberId: string; claimUrl: string }; onReset: () => void; resetLabel: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
        <Check className="h-5 w-5 text-white" />
      </div>
      <p className="font-semibold text-stone-900">{created.name} created</p>
      <p className="mt-1 text-sm text-stone-600">Add their content now, or send them a claim link.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <ActionLink href={`/vendor/products?memberId=${created.memberId}`} icon={Package} label="Add products" />
        <ActionLink href={`/vendor/events?memberId=${created.memberId}`} icon={Calendar} label="Add events" />
        <ActionLink href={`/members/${created.memberId}`} icon={ExternalLink} label="View profile" />
      </div>
      <Link href={created.claimUrl} className="mt-3 inline-block break-all text-xs font-medium text-indigo-600 hover:underline">
        Claim link: {created.claimUrl}
      </Link>
      <div className="mt-4">
        <button onClick={onReset} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

// ── Act on behalf: search a member, then jump to manage their stuff ──────────
interface FoundMember {
  id: string;
  name: string;
  city?: string;
  type?: string;
}

function ActOnBehalf() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<FoundMember | null>(null);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "https://community-connector-agent.netlify.app";
      const url = new URL("/.netlify/functions/marketplace-members", base);
      url.searchParams.set("search", query.trim());
      const res = await fetch(url.toString());
      const data = res.ok ? await res.json() : { members: [] };
      setResults(Array.isArray(data.members) ? data.members : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  if (picked) {
    return (
      <div className="space-y-4">
        <button onClick={() => setPicked(null)} className="text-sm text-stone-500 hover:text-stone-800">← Back to search</button>
        <div className="card-soft p-5">
          <p className="text-sm font-semibold text-stone-900">{picked.name}</p>
          {picked.city && <p className="text-xs text-stone-500">{picked.city}</p>}
          <p className="mt-3 mb-2 text-xs text-stone-500">Add content on their behalf — both screens include AI capture (snap a menu, flyer, or schedule):</p>
          <div className="flex flex-wrap gap-2">
            <ActionLink href={`/vendor/products?memberId=${picked.id}`} icon={Package} label="Products" />
            <ActionLink href={`/vendor/events?memberId=${picked.id}`} icon={Calendar} label="Events" />
            <ActionLink href={`/members/${picked.id}`} icon={ExternalLink} label="View profile" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search any business by name (e.g. SF Library)…"
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm"
        />
        <button onClick={search} disabled={loading} className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
          {loading ? "…" : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {results.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">{m.name}</p>
                <p className="text-xs text-stone-500">{[m.type, m.city].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => setPicked(m)} className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-700">
                Manage
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-stone-500">No members found. Try a different name, or create the profile in the “Create profile” tab.</p>
      )}
    </div>
  );
}

function ActionLink({ href, icon: Icon, label }: { href: string; icon: typeof Shield; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:border-stone-300 hover:text-stone-900">
      <Icon className="h-3.5 w-3.5 text-indigo-500" /> {label}
    </Link>
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
