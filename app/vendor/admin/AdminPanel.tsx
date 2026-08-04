"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, UserPlus, FileText, Search, Check, Package, Calendar, ExternalLink, Star, PenSquare, ImagePlus, X, Loader2, Store, Radio, Globe, ChevronDown, ClipboardCheck } from "lucide-react";
import { OnboardManager } from "../onboard/OnboardManager";
import { FeaturedManager } from "../featured/FeaturedManager";
import { LineupImportManager } from "@/components/admin/LineupImportManager";
import { EventDrafts } from "@/components/admin/EventDrafts";
import { SourcingAdmin } from "@/app/prototype/admin/page"; // prototype "Sourcing" panel, embedded as a tab
import { OrganizeManager } from "@/app/vendor/organize/OrganizeManager"; // the "Run an event" (/organizers) toolkit, embedded as a tab
import { ORG_FOCUS } from "@/lib/org-focus";

const TYPES = ["vendor", "artist", "organizer", "shopper", "influencer"] as const;

// "Add by transcript" is no longer a tab — it lives as an expandable panel at
// the top of the Create-profile content (both create members, so they belong
// together).
type Tab = "create" | "behalf" | "sourcing" | "drafts" | "organizer" | "post" | "featured";
// "post" and "featured" are parked (disabled) — kept at the END of the order.
const TABS: Tab[] = ["create", "behalf", "sourcing", "drafts", "organizer", "post", "featured"];
const DISABLED_TABS: Tab[] = ["post", "featured"];

export function AdminPanel({ ownerMemberId }: { ownerMemberId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const [showTranscript, setShowTranscript] = useState(false);
  // Master-detail: hide the top tab pills when drilled into a city (Sourcing)
  // or an org (Act on behalf → a member is selected via ?memberId).
  const [sourcingDetail, setSourcingDetail] = useState(false);
  const isSelectable = (t: string): t is Tab => TABS.includes(t as Tab) && !DISABLED_TABS.includes(t as Tab);
  const tab: Tab = isSelectable(tabParam ?? "") ? (tabParam as Tab) : "create";

  // Persist the active tab in the URL so navigating into a member's
  // products/events and back (or the "Go back" bar) restores this view.
  const setTab = (t: Tab) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", t);
    if (t !== "behalf") {
      ["memberId", "mName", "mCity", "mType", "q"].forEach((k) => sp.delete(k));
    }
    router.replace(`/vendor/admin?${sp.toString()}`);
  };

  // Hide the top tab pills (and the header blurb) when drilled into a detail:
  // a Sourcing city, or an Act-on-behalf member (an org, keyed by ?memberId).
  const hidePills =
    (tab === "sourcing" && sourcingDetail) || (tab === "behalf" && !!params.get("memberId"));

  return (
    <div className="space-y-6">
      {!hidePills && (
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
            <Shield className="h-6 w-6 text-indigo-500" /> Super-admin
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Create profiles, onboard from a conversation, and add events/products on behalf of any business — even ones that haven&apos;t signed up.
          </p>
        </div>
      )}

      {!hidePills && (
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "create"} onClick={() => setTab("create")} icon={UserPlus} label="Create profile" />
          <TabButton active={tab === "behalf"} onClick={() => setTab("behalf")} icon={Search} label="Act on behalf" />
          <TabButton active={tab === "sourcing"} onClick={() => setTab("sourcing")} icon={Globe} label="Sourcing" />
          {/* Sits beside Sourcing: it reviews what Sourcing brings in. */}
          <TabButton active={tab === "drafts"} onClick={() => setTab("drafts")} icon={ClipboardCheck} label="Scraped drafts" />
          <TabButton active={tab === "organizer"} onClick={() => setTab("organizer")} icon={Calendar} label="Organizer" />
          <TabButton active={tab === "post"} onClick={() => setTab("post")} icon={PenSquare} label="Add post" disabled />
          <TabButton active={tab === "featured"} onClick={() => setTab("featured")} icon={Star} label="Featured lists" disabled />
        </div>
      )}

      {tab === "create" && (
        <div className="space-y-4">
          {/* Bulk import a whole festival/market lineup from a photo. */}
          <LineupImportManager ownerMemberId={ownerMemberId} />

          {/* Add-by-transcript: an expandable panel on top of Create profile
              (was its own tab). Both create members from different inputs. */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              aria-expanded={showTranscript}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-stone-50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-stone-800">
                <FileText className="h-4 w-4 text-indigo-500" /> Add by transcript
              </span>
              <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform ${showTranscript ? "rotate-180" : ""}`} />
            </button>
            {showTranscript && (
              <div className="border-t border-stone-100 p-4">
                <OnboardManager memberId={ownerMemberId} isAdmin />
              </div>
            )}
          </div>

          <CreateProfile ownerMemberId={ownerMemberId} />
        </div>
      )}
      {tab === "behalf" && <ActOnBehalf />}
      {tab === "post" && <AddPost />}
      {tab === "featured" && <FeaturedManager />}
      {tab === "sourcing" && <SourcingAdmin onDetailChange={setSourcingDetail} />}

      {tab === "drafts" && <EventDrafts />}
      {/* Same toolkit as the footer "Run an event" page (/organizers): a
          no-login demo preview on sample data — nothing persists. */}
      {tab === "organizer" && (
        <OrganizeManager memberId="demo-organizer" isAdmin={false} emailReady demo eventOrganizer />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, disabled = false }: { active: boolean; onClick: () => void; icon: typeof Shield; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={disabled ? "Disabled" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
        disabled
          ? "cursor-not-allowed bg-stone-100 text-stone-400 line-through opacity-60"
          : active
            ? "bg-stone-900 text-white"
            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
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
    trustedPhone: "",
    websiteUrl: "",
    organizerFocus: "",
  });
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<{ name: string; memberId: string; claimUrl: string } | null>(null);

  const up = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Google Places: search a business → pick the real listing → auto-fill.
  const [pq, setPq] = useState("");
  const [results, setResults] = useState<{ placeId: string; name: string; address: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (pq.trim().length < 3 || picked) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/places/search?q=${encodeURIComponent(pq)}`);
        const d = await r.json();
        setResults(d.results || []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [pq, picked]);

  async function pickPlace(placeId: string, name: string) {
    setResults([]); setPq(name); setPicked(true); setBusy(true);
    try {
      const r = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
      const p = (await r.json()).details;
      if (p) {
        const GENERIC = new Set(["point_of_interest", "establishment", "food", "store"]);
        const cat = (p.types || []).find((t: string) => !GENERIC.has(t));
        setForm((f) => ({
          ...f,
          name: p.name || f.name,
          category: cat ? String(cat).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : f.category,
          city: p.city || f.city,
          neighborhood: p.neighborhood || f.neighborhood,
          phone: p.phone || f.phone,
          websiteUrl: p.website || f.websiteUrl,
          businessDescription: p.summary || f.businessDescription,
        }));
      }
    } catch { /* leave form as-is */ } finally { setBusy(false); }
  }

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
            trustedPhone: form.trustedPhone.trim() || undefined,
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
    setForm({ name: "", memberType: "vendor", category: "", city: "", neighborhood: "", businessDescription: "", instagramHandle: "", phone: "", trustedPhone: "", websiteUrl: "", organizerFocus: "" });
    setTags("");
    setCreated(null);
    setErr("");
  }

  if (created) return <CreatedCard created={created} onReset={reset} resetLabel="Create another" />;

  return (
    <div className="card-soft space-y-3 p-4">
      {/* Find them on Google → auto-fill (no typing) */}
      <div className="relative">
        <p className="section-label">Find them on Google</p>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            value={pq}
            onChange={(e) => { setPq(e.target.value); setPicked(false); }}
            placeholder="Search the business — e.g. Zeitgeist SF"
            className="w-full text-sm outline-none"
          />
          {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-stone-400" />}
        </div>
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
            {results.map((r) => (
              <button
                key={r.placeId}
                type="button"
                onClick={() => pickPlace(r.placeId, r.name)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-stone-100 px-3 py-2 text-left hover:bg-stone-50 last:border-0"
              >
                <span className="text-sm font-medium text-stone-900">{r.name}</span>
                <span className="text-xs text-stone-500">{r.address}</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-stone-400">
          {picked
            ? "✓ Auto-filled from Google — review & edit below, then create. The story + vibe enrich automatically after."
            : "Google fills name, category, address, phone & website — you type nothing. Or fill it in manually below."}
        </p>
      </div>

      <p className="section-label pt-1">Basic profile</p>
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
      <Field label="Trusted onboarding number">
        <input value={form.trustedPhone} onChange={(e) => up("trustedPhone", e.target.value)} placeholder="+1 415 555 0123 — only this number can call/text to onboard" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        <p className="mt-1 text-xs text-stone-400">Set the number you confirmed in person. Only a call/text from it can onboard or claim this profile — no one else.</p>
      </Field>
      <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="farmers market, sf library" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></Field>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={create} disabled={busy} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Creating…" : "Create profile"}
        </button>
        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>
    </div>
  );
}

function CreatedCard({ created, onReset, resetLabel }: { created: { name: string; memberId: string; claimUrl: string }; onReset: () => void; resetLabel: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
        <Check className="h-5 w-5 text-white" />
      </div>
      <p className="font-semibold text-stone-900">{created.name} created</p>
      <p className="mt-1 text-sm text-stone-600">Add their content now, or send them a claim link.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <ActionLink href={`/vendor/products?memberId=${created.memberId}`} icon={Package} label="Add products" />
        <ActionLink href={`/vendor/events?memberId=${created.memberId}`} icon={Calendar} label="Add events" />
        <ActionLink href={`/vendor/live?memberId=${created.memberId}`} icon={Radio} label="Schedule live" />
        <ActionLink href={`/members/${created.memberId}`} icon={ExternalLink} label="View profile" />
      </div>
      <Link href={created.claimUrl} className="mt-3 inline-block break-all text-xs font-medium text-indigo-600 hover:underline">
        Claim link: {created.claimUrl}
      </Link>
      <div className="mt-4">
        <button onClick={onReset} className="rounded-lg bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800">
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

// Connector member shape — name/city/type live under `profile`.
interface RawMember {
  id: string;
  profile?: { name?: string; memberType?: string; city?: string };
  name?: string;
  city?: string;
  type?: string;
}
function normalize(m: RawMember): FoundMember {
  return {
    id: m.id,
    name: m.profile?.name || m.name || "Unnamed member",
    city: m.profile?.city || m.city,
    type: m.profile?.memberType || m.type,
  };
}

function ActOnBehalf() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<FoundMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Picked member is held in the URL so it survives navigating into their
  // products/events and back (browser back or the "Go back" bar).
  const picked: FoundMember | null = params.get("memberId")
    ? {
        id: params.get("memberId")!,
        name: params.get("mName") || "Member",
        city: params.get("mCity") || undefined,
        type: params.get("mType") || undefined,
      }
    : null;

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "https://community-connector-agent.netlify.app";
      const url = new URL("/.netlify/functions/marketplace-members", base);
      url.searchParams.set("search", q.trim());
      const res = await fetch(url.toString());
      const data = res.ok ? await res.json() : { members: [] };
      setResults(Array.isArray(data.members) ? data.members.map(normalize) : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run the search when landing back on the search view with a ?q (e.g. after
  // "Back to search" or browser-back from a managed member).
  useEffect(() => {
    const q = params.get("q");
    if (q && !params.get("memberId")) runSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function search() {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", "behalf");
    if (query.trim()) sp.set("q", query.trim()); else sp.delete("q");
    ["memberId", "mName", "mCity", "mType"].forEach((k) => sp.delete(k));
    router.replace(`/vendor/admin?${sp.toString()}`);
    runSearch(query);
  }

  function pick(m: FoundMember) {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", "behalf");
    if (query.trim()) sp.set("q", query.trim());
    sp.set("memberId", m.id);
    sp.set("mName", m.name);
    if (m.city) sp.set("mCity", m.city); else sp.delete("mCity");
    if (m.type) sp.set("mType", m.type); else sp.delete("mType");
    router.push(`/vendor/admin?${sp.toString()}`);
  }

  function backToSearch() {
    const sp = new URLSearchParams(params.toString());
    ["memberId", "mName", "mCity", "mType"].forEach((k) => sp.delete(k));
    router.push(`/vendor/admin?${sp.toString()}`);
  }

  if (picked) {
    return (
      <div className="space-y-4">
        <button onClick={backToSearch} className="text-sm text-stone-500 hover:text-stone-800">← Back to search</button>
        <div className="card-soft p-4">
          <p className="text-sm font-semibold text-stone-900">{picked.name}</p>
          {(picked.type || picked.city) && (
            <p className="text-xs text-stone-500">{[picked.type, picked.city].filter(Boolean).join(" · ")}</p>
          )}
          <p className="mt-3 mb-2 text-xs text-stone-500">Add content on their behalf — Products &amp; Events include AI capture (snap a menu, flyer, or schedule); Live lets you post or schedule what they&apos;re showing (World Cup, UFC, etc.):</p>
          <div className="flex flex-wrap gap-2">
            <ActionLink href={`/vendor/products?memberId=${picked.id}`} icon={Package} label="Products" />
            <ActionLink href={`/vendor/events?memberId=${picked.id}`} icon={Calendar} label="Events" />
            <ActionLink href={`/vendor/live?memberId=${picked.id}`} icon={Radio} label="Live" />
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
                {(m.type || m.city) && (
                  <p className="text-xs text-stone-500">{[m.type, m.city].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <button onClick={() => pick(m)} className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-700">
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

// ── Add a share post (optionally tagged to a business) ───────────────────────
interface PostMedia {
  url: string;
  kind: "image" | "video";
}

function AddPost() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [tagged, setTagged] = useState<FoundMember | null>(null);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "https://community-connector-agent.netlify.app";
      const url = new URL("/.netlify/functions/marketplace-members", base);
      url.searchParams.set("search", query.trim());
      const res = await fetch(url.toString());
      const data = res.ok ? await res.json() : { members: [] };
      setResults(Array.isArray(data.members) ? data.members.map(normalize) : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr("");
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/share/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) setMedia((m) => [...m, { url: data.url, kind: data.kind }]);
        else setErr(data.error ?? "Upload failed");
      } catch {
        setErr("Upload failed");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          imageUrls: media.filter((m) => m.kind === "image").map((m) => m.url),
          videoUrls: media.filter((m) => m.kind === "video").map((m) => m.url),
          taggedMemberId: tagged?.id ?? null,
          taggedMemberName: tagged?.name ?? null,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setBody("");
        setMedia([]);
        setDone(true);
      } else {
        setErr(data.error ?? "Failed to post");
      }
    } catch {
      setErr("Failed to post");
    } finally {
      setBusy(false);
    }
  }

  const canPost = (body.trim() || media.length > 0) && !busy && !uploading;

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
          <Check className="h-5 w-5 text-white" />
        </div>
        <p className="font-semibold text-stone-900">Posted</p>
        <p className="mt-1 text-sm text-stone-600">
          {tagged ? `Shared to ${tagged.name}'s memories and the feed.` : "Shared to the community feed."}
        </p>
        <button onClick={() => setDone(false)} className="mt-4 rounded-lg bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800">
          Post another
        </button>
      </div>
    );
  }

  return (
    <div className="card-soft space-y-3 p-4">
      <p className="section-label">New post</p>

      {/* Tag a business */}
      {tagged ? (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
          <Store className="h-4 w-4 text-indigo-500" />
          <span className="flex-1 truncate text-sm font-medium text-stone-800">{tagged.name}</span>
          <button onClick={() => setTagged(null)} aria-label="Remove tag" className="text-stone-400 hover:text-stone-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Tag a business (optional)…"
              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <button onClick={search} disabled={searching} className="rounded-lg bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {searching ? "…" : "Search"}
            </button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
              {results.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{m.name}</p>
                    {(m.type || m.city) && <p className="text-xs text-stone-500">{[m.type, m.city].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <button onClick={() => { setTagged(m); setResults([]); setQuery(""); }} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200">
                    Tag
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="What's happening?"
        className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm"
      />

      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
              {m.kind === "image" ? (
                <Image src={m.url} alt="" fill sizes="33vw" className="object-cover" />
              ) : (
                <video src={m.url} className="h-full w-full object-cover" muted />
              )}
              <button
                onClick={() => setMedia((arr) => arr.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          <ImagePlus className="h-4 w-4" /> Photo / video
        </button>
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={submit} disabled={!canPost} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Posting…" : "Post"}
        </button>
        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>
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
