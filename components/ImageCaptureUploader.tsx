"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Check, X } from "lucide-react";

type Mode = "products" | "events";

interface ProductDraft {
  name: string;
  description: string | null;
  price: number; // cents
  currency: string;
  image_url?: string | null;
  refined?: boolean;
}
interface EventDraft {
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  poster_image_url: string | null;
}

export function ImageCaptureUploader({
  memberId,
  memberName,
  mode,
  onSaved,
}: {
  memberId: string;
  memberName: string;
  mode: Mode;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<ProductDraft[]>([]);
  const [eventDrafts, setEventDrafts] = useState<EventDraft[]>([]);
  const pendingAction = useRef<"menu" | "counter" | "flyer">("menu");
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(action: "menu" | "counter" | "flyer") {
    pendingAction.current = action;
    setError(null);
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUpgrade(null);
    setNotice(null);

    try {
      setBusy("Uploading photo…");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("memberId", memberId);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) throw new Error("Upload failed");
      const { url } = await up.json();

      const action = pendingAction.current;
      if (action === "counter") {
        setBusy("Detecting products & generating images…");
        const res = await fetch("/api/ai/detect-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url, memberId }),
        });
        const data = await res.json();
        if (res.status === 402 || res.status === 429) {
          setUpgrade(data.error || "Upgrade your subscription to keep generating AI images.");
          return;
        }
        if (!res.ok) throw new Error(data.error || "Detection failed");
        setProductDrafts(data.products ?? []);
        if (data.quota && !data.quota.premium && typeof data.quota.remainingFree === "number") {
          setNotice(
            data.quota.remainingFree > 0
              ? `${data.quota.remainingFree} free AI image${data.quota.remainingFree === 1 ? "" : "s"} left.`
              : "That was your last free AI image — upgrade to keep generating."
          );
        }
      } else {
        setBusy(mode === "events" ? "Reading flyer…" : "Reading menu…");
        const res = await fetch("/api/ai/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url, mode, memberId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Extraction failed");
        if (mode === "events") setEventDrafts(data.events ?? []);
        else setProductDrafts((data.products ?? []).map((p: ProductDraft) => ({ ...p, image_url: null })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function publishProducts(active: boolean) {
    setBusy("Saving…");
    try {
      await fetch(`/api/products/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName,
          products: productDrafts.map((p) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            currency: p.currency,
            image_url: p.image_url ?? null,
            active,
            source: p.refined ? "ai_counter" : "ai_menu",
          })),
        }),
      });
      setProductDrafts([]);
      onSaved();
    } finally {
      setBusy(null);
    }
  }

  async function publishEvents(active: boolean) {
    setBusy("Saving…");
    try {
      await fetch(`/api/events/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName,
          events: eventDrafts.map((e) => ({ ...e, active, source: "ai_flyer" })),
        }),
      });
      setEventDrafts([]);
      onSaved();
    } finally {
      setBusy(null);
    }
  }

  const hasDrafts = productDrafts.length > 0 || eventDrafts.length > 0;

  return (
    <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />

      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <p className="text-sm font-semibold text-stone-800">Add with a photo</p>
      </div>

      {!hasDrafts && (
        <div className="mt-3 flex flex-wrap gap-2">
          {mode === "products" ? (
            <>
              <CaptureBtn onClick={() => pick("menu")} label="Scan a menu" />
              <CaptureBtn onClick={() => pick("counter")} label="Scan a counter / shelf" />
            </>
          ) : (
            <CaptureBtn onClick={() => pick("flyer")} label="Scan a flyer" />
          )}
        </div>
      )}

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-sm text-indigo-700">
          <Loader2 className="h-4 w-4 animate-spin" /> {busy}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-3 text-xs text-stone-500">{notice}</p>}
      {upgrade && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Premium feature</p>
          <p className="mt-0.5 text-xs text-amber-700">{upgrade}</p>
          <a href="/vendor/billing" className="mt-2 inline-block rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800">
            Upgrade
          </a>
        </div>
      )}

      {/* Product draft review */}
      {productDrafts.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-stone-500">Review {productDrafts.length} detected — edit, then publish or save as draft.</p>
          {productDrafts.map((p, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover" />
              )}
              <div className="flex-1 space-y-1.5">
                <input
                  value={p.name}
                  onChange={(e) => setProductDrafts((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="w-full rounded-md border border-stone-200 px-2 py-1 text-sm font-medium"
                />
                <input
                  value={p.description ?? ""}
                  placeholder="Description"
                  onChange={(e) => setProductDrafts((d) => d.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">$</span>
                  <input
                    type="number"
                    value={(p.price / 100).toString()}
                    onChange={(e) => setProductDrafts((d) => d.map((x, j) => (j === i ? { ...x, price: Math.round(parseFloat(e.target.value || "0") * 100) } : x)))}
                    className="w-24 rounded-md border border-stone-200 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <button onClick={() => setProductDrafts((d) => d.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <DraftActions onPublish={() => publishProducts(true)} onDraft={() => publishProducts(false)} onCancel={() => setProductDrafts([])} busy={!!busy} />
        </div>
      )}

      {/* Event draft review */}
      {eventDrafts.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-stone-500">Review {eventDrafts.length} event(s) — the photo becomes the poster.</p>
          {eventDrafts.map((ev, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
              {ev.poster_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.poster_image_url} alt={ev.title} className="h-20 w-16 rounded-lg object-cover" />
              )}
              <div className="flex-1 space-y-1.5">
                <input
                  value={ev.title}
                  onChange={(e) => setEventDrafts((d) => d.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  className="w-full rounded-md border border-stone-200 px-2 py-1 text-sm font-medium"
                />
                <div className="flex gap-2">
                  <input value={ev.event_date ?? ""} placeholder="Date" onChange={(e) => setEventDrafts((d) => d.map((x, j) => (j === i ? { ...x, event_date: e.target.value } : x)))} className="w-1/2 rounded-md border border-stone-200 px-2 py-1 text-xs" />
                  <input value={ev.event_time ?? ""} placeholder="Time" onChange={(e) => setEventDrafts((d) => d.map((x, j) => (j === i ? { ...x, event_time: e.target.value } : x)))} className="w-1/2 rounded-md border border-stone-200 px-2 py-1 text-xs" />
                </div>
                <input value={ev.location ?? ""} placeholder="Location" onChange={(e) => setEventDrafts((d) => d.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))} className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs" />
                <textarea value={ev.description ?? ""} placeholder="Description" rows={2} onChange={(e) => setEventDrafts((d) => d.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600" />
              </div>
              <button onClick={() => setEventDrafts((d) => d.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <DraftActions onPublish={() => publishEvents(true)} onDraft={() => publishEvents(false)} onCancel={() => setEventDrafts([])} busy={!!busy} />
        </div>
      )}
    </div>
  );
}

function CaptureBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
      <Camera className="h-4 w-4" /> {label}
    </button>
  );
}

function DraftActions({ onPublish, onDraft, onCancel, busy }: { onPublish: () => void; onDraft: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onPublish} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        <Check className="h-4 w-4" /> Publish all
      </button>
      <button onClick={onDraft} disabled={busy} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">
        Save as drafts
      </button>
      <button onClick={onCancel} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-stone-500 hover:text-stone-700">
        Cancel
      </button>
    </div>
  );
}
