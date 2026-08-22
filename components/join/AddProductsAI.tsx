"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";

/**
 * Fill a catalogue during onboarding, without a Square register.
 *
 * Two ways in, and they are the same list underneath:
 *
 *  - A PHOTO. /api/ai/extract in `products` mode reads a menu, a price list, a
 *    shelf card — names, descriptions and PRICES, because a menu photo has the
 *    prices written on it. That endpoint meters scans and nothing else: no
 *    image generation, so it does not hit the image quota that would refuse
 *    every free account, which is exactly what a new vendor is.
 *  - BY HAND. One row at a time, for the vendor whose stock is in their head.
 *
 * Nothing is saved until they press save, and what is saved is what is on
 * screen: the model proposes, the person confirms. A price the model could not
 * read stays empty and blocks that row rather than guessing a number — a wrong
 * price is a sale at the wrong money, not a typo.
 */
export interface DraftProduct {
  name: string;
  description: string | null;
  /** Cents. Empty until someone commits to a number. */
  price: number | null;
}

export function AddProductsAI({
  memberId,
  memberName,
  demo = false,
  onSaved,
}: {
  memberId: string;
  memberName: string;
  demo?: boolean;
  onSaved: (names: string[]) => void;
}) {
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ready = drafts.filter((d) => d.name.trim() && d.price != null && d.price >= 0);

  async function onPick(file: File) {
    setErr("");
    setScanning(true);
    try {
      // Sent as a data URL — the same shape the vendor dashboard's capture uses,
      // and it avoids uploading a photo we may never keep.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Couldn't read that image"));
        r.readAsDataURL(file);
      });

      if (demo) {
        setDrafts((d) => [
          ...d,
          { name: "Tamale — pork", description: "Slow-cooked, banana leaf", price: 450 },
          { name: "Tamale — rajas", description: "Poblano and cheese", price: 425 },
        ]);
        return;
      }

      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: dataUrl, mode: "products", memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't read that photo.");

      const found: DraftProduct[] = (data.products ?? []).map(
        (p: { name: string; description?: string | null; price_cents?: number | null }) => ({
          name: String(p.name ?? "").trim(),
          description: p.description ?? null,
          price: typeof p.price_cents === "number" ? p.price_cents : null,
        }),
      );
      if (found.length === 0) {
        setErr("Nothing readable in that one. Try a straighter shot of the list, or add them by hand.");
        return;
      }
      setDrafts((d) => [...d, ...found]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that photo.");
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (ready.length === 0) return;
    setSaving(true);
    setErr("");
    try {
      if (!demo) {
        const res = await fetch(`/api/products/${memberId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberName,
            products: ready.map((d) => ({
              name: d.name.trim(),
              description: d.description,
              price: d.price,
            })),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Couldn't save those.");
        }
      }
      onSaved(ready.map((d) => d.name.trim()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save those.");
      setSaving(false);
    }
  }

  const edit = (i: number, patch: Partial<DraftProduct>) =>
    setDrafts((d) => d.map((row, n) => (n === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-3">
      {err && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{err}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 active:scale-[0.98] disabled:opacity-60 sm:p-5"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-coral-600 text-white sm:h-14 sm:w-14">
          {scanning ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-stone-900 sm:text-[17px]">
            {scanning ? "Reading your photo…" : "Photograph your menu or price list"}
          </span>
          <span className="mt-0.5 block text-[14px] leading-relaxed text-stone-500">
            We read the names and prices off it. You check them before anything is saved.
          </span>
        </span>
      </button>

      <button
        onClick={() => setDrafts((d) => [...d, { name: "", description: null, price: null }])}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-stone-600 transition hover:text-stone-900"
      >
        <Plus className="h-4 w-4" /> Add one by hand
      </button>

      {drafts.length > 0 && (
        <div className="space-y-2 pt-1">
          {drafts.map((d, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-3">
              <div className="flex items-start gap-2">
                <input
                  value={d.name}
                  onChange={(e) => edit(i, { name: e.target.value })}
                  placeholder="What is it?"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-[15px] outline-none focus:border-stone-900"
                />
                {/* Dollars in, cents stored. Empty is a real state — it means
                    nobody has said what this costs yet, and it holds the row
                    back rather than shipping a guess. */}
                <input
                  value={d.price == null ? "" : (d.price / 100).toString()}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    const n = Number(v);
                    edit(i, { price: v === "" || !Number.isFinite(n) ? null : Math.round(n * 100) });
                  }}
                  inputMode="decimal"
                  placeholder="$"
                  className="h-10 w-20 shrink-0 rounded-lg border border-stone-200 px-3 text-[15px] outline-none focus:border-stone-900"
                />
                <button
                  onClick={() => setDrafts((rows) => rows.filter((_, n) => n !== i))}
                  className="mt-1.5 shrink-0 text-stone-300 transition hover:text-rose-600"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {d.description && (
                <p className="mt-1.5 line-clamp-2 pl-1 text-[13px] text-stone-500">{d.description}</p>
              )}
              {d.name.trim() && d.price == null && (
                <p className="mt-1.5 pl-1 text-[12px] text-amber-700">Needs a price before it can sell.</p>
              )}
            </div>
          ))}

          <button
            onClick={() => void save()}
            disabled={ready.length === 0 || saving}
            className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-[15px] font-semibold text-white transition hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving
              ? "Saving…"
              : `Save ${ready.length || ""} ${ready.length === 1 ? "product" : "products"}`.trim()}
          </button>
        </div>
      )}
    </div>
  );
}
