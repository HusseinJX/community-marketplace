"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Check, X, Trash2, Users } from "lucide-react";

// Super-admin: snap a festival/market lineup poster or exhibitor list → AI
// extracts every vendor → review/edit/deselect → create them all at once, each
// tagged with the festival (member_tags). Mirrors the image→AI capture used for
// products and events, but the output is a batch of new member profiles.
interface VendorRow {
  id: number;
  name: string;
  category: string;
  description: string;
  include: boolean;
}

type Result = {
  created: { name: string; memberId: string; claimUrl: string }[];
  failed: { name: string; error: string }[];
  tag: string | null;
};

export function LineupImportManager({ ownerMemberId }: { ownerMemberId: string }) {
  const [festival, setFestival] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const selectedCount = rows.filter((r) => r.include).length;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);

    try {
      setBusy("Uploading photo…");
      const fd = new FormData();
      fd.append("file", file);
      if (ownerMemberId) fd.append("memberId", ownerMemberId);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) throw new Error((await up.json().catch(() => ({}))).error || "Upload failed");
      const { url } = await up.json();

      setBusy("Reading the lineup…");
      const ex = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, mode: "lineup", memberId: ownerMemberId || undefined }),
      });
      if (!ex.ok) throw new Error((await ex.json().catch(() => ({}))).error || "Could not read the image");
      const data = await ex.json();
      const vendors: { name: string; category: string | null; description: string | null }[] = data.vendors ?? [];
      if (vendors.length === 0) {
        setError("No vendors found in that image. Try a clearer photo of the lineup.");
        setRows([]);
        return;
      }
      setRows(
        vendors.map((v) => ({
          id: nextId.current++,
          name: v.name,
          category: v.category ?? "",
          description: v.description ?? "",
          include: true,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const update = (id: number, patch: Partial<VendorRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  async function createAll() {
    const picked = rows.filter((r) => r.include && r.name.trim());
    if (picked.length === 0) return;
    setError(null);
    try {
      setBusy(`Creating ${picked.length} vendor${picked.length === 1 ? "" : "s"}…`);
      const res = await fetch("/api/members/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendors: picked.map((r) => ({ name: r.name.trim(), category: r.category.trim() || undefined, description: r.description.trim() || undefined })),
          tag: festival.trim() || undefined,
          ownerMemberId: ownerMemberId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Create failed");
      const data: Result = await res.json();
      setResult(data);
      // Drop the successfully-created rows from the review list.
      const createdNames = new Set(data.created.map((c) => c.name));
      setRows((rs) => rs.filter((r) => !createdNames.has(r.name.trim())));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 bg-stone-50 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800">
          <Users className="h-4 w-4 text-emerald-600" /> Import a lineup from a photo
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          Snap a festival/market lineup or exhibitor list — AI extracts every vendor, you review, then create them all at once (tagged with the festival).
        </p>
      </div>

      <div className="space-y-4 p-4">
        {/* Festival tag + capture */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs font-semibold text-stone-500">Festival / group name (tags every vendor)</label>
            <input
              value={festival}
              onChange={(e) => setFestival(e.target.value)}
              placeholder="e.g. Mission Street Fair 2026"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {busy ?? (rows.length ? "Scan another" : "Take / upload photo")}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {/* Review list */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {selectedCount} of {rows.length} selected
              </p>
              <div className="flex gap-2 text-xs">
                <button onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: true })))} className="font-semibold text-indigo-600 hover:underline">Select all</button>
                <button onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))} className="font-semibold text-stone-500 hover:underline">None</button>
              </div>
            </div>

            {rows.map((r) => (
              <div
                key={r.id}
                className={`flex items-start gap-2 rounded-xl border p-2.5 transition ${
                  r.include ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => update(r.id, { include: e.target.checked })}
                  className="mt-2 h-4 w-4 accent-emerald-600"
                />
                <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[1fr_10rem]">
                  <input
                    value={r.name}
                    onChange={(e) => update(r.id, { name: e.target.value })}
                    placeholder="Vendor name"
                    className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm font-medium"
                  />
                  <input
                    value={r.category}
                    onChange={(e) => update(r.id, { category: e.target.value })}
                    placeholder="Category"
                    className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm"
                  />
                  {r.description && (
                    <input
                      value={r.description}
                      onChange={(e) => update(r.id, { description: e.target.value })}
                      placeholder="Description"
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 sm:col-span-2"
                    />
                  )}
                </div>
                <button onClick={() => remove(r.id)} aria-label="Remove" className="mt-1.5 text-stone-300 transition hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              onClick={createAll}
              disabled={!!busy || selectedCount === 0}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Create {selectedCount} vendor{selectedCount === 1 ? "" : "s"}
              {festival.trim() && ` · tag "${festival.trim()}"`}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <Check className="h-4 w-4" /> Created {result.created.length} vendor{result.created.length === 1 ? "" : "s"}
              {result.tag && ` · tagged "${result.tag}"`}
            </p>
            <ul className="space-y-1 text-xs">
              {result.created.map((c) => (
                <li key={c.memberId} className="flex items-center justify-between gap-2">
                  <span className="truncate text-stone-700">{c.name}</span>
                  <a href={`/members/${c.memberId}`} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-indigo-600 hover:underline">View →</a>
                </li>
              ))}
            </ul>
            {result.failed.length > 0 && (
              <div className="rounded-lg bg-white/60 p-2 text-xs text-rose-700">
                <p className="flex items-center gap-1 font-semibold"><X className="h-3.5 w-3.5" /> {result.failed.length} failed</p>
                <ul className="mt-1 list-disc pl-4">
                  {result.failed.map((f, i) => <li key={i}>{f.name} — {f.error}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
