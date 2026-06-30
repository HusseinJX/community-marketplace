"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { BUSINESS_SIZES, OWNERSHIP_TAGS, sizeLabel, ownershipLabel } from "@/lib/business-facets";

// Shows a business's size + ownership facets; the owner/admin can edit them.
// Renders nothing when there's nothing to show and the viewer can't edit.
export function BusinessFacets({
  memberId,
  initialSize,
  initialOwnership,
  canEdit,
}: {
  memberId: string;
  initialSize?: string | null;
  initialOwnership?: string[];
  canEdit: boolean;
}) {
  const [size, setSize] = useState(initialSize ?? "");
  const [own, setOwn] = useState<string[]>(initialOwnership ?? []);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasAny = !!size || own.length > 0;
  if (!hasAny && !canEdit) return null;

  const toggle = (k: string) => setOwn((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/members/${memberId}/facets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessSize: size || undefined, ownershipTags: own }),
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <p className="section-label">Business</p>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {size && <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-700">{sizeLabel(size)}</span>}
          {own.map((o) => (
            <span key={o} className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">{ownershipLabel(o)}</span>
          ))}
          {!hasAny && <span className="text-sm text-stone-400">Not set</span>}
        </div>
      ) : (
        <div className="space-y-3">
          <select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <option value="">— size unknown —</option>
            {BUSINESS_SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {OWNERSHIP_TAGS.map((o) => (
              <button
                key={o.key}
                onClick={() => toggle(o.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${own.includes(o.key) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-stone-500 hover:text-stone-800">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
