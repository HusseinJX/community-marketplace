"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, ExternalLink, Loader2, Sparkles, X } from "lucide-react";

interface EventDraft {
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  poster_image_url: string | null;
}

interface CreatedEvent {
  id: string;
  title: string;
}

export function PublicEventFlyerImport({ ownerMemberId }: { ownerMemberId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [created, setCreated] = useState<CreatedEvent[]>([]);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setCreated([]);
    try {
      setBusy("Uploading flyer...");
      const form = new FormData();
      form.append("file", file);
      form.append("memberId", ownerMemberId);
      const upload = await fetch("/api/upload", { method: "POST", body: form });
      const uploadBody = await upload.json().catch(() => ({}));
      if (!upload.ok) throw new Error(uploadBody.error || "Upload failed");

      setBusy("Reading flyer...");
      const extracted = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadBody.url,
          mode: "events",
          memberId: ownerMemberId,
        }),
      });
      const extractedBody = await extracted.json().catch(() => ({}));
      if (!extracted.ok) throw new Error(extractedBody.error || "Could not read the flyer");
      const events: EventDraft[] = extractedBody.events ?? [];
      if (!events.length) throw new Error("No events found in that flyer");
      setDrafts(events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const update = (index: number, patch: Partial<EventDraft>) =>
    setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function publish() {
    if (!drafts.length) return;
    setError(null);
    setBusy("Publishing...");
    try {
      const response = await fetch("/api/admin/public-event-flyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: drafts }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not publish events");
      setCreated(body.created ?? []);
      setDrafts([]);
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
          <Sparkles className="h-4 w-4 text-coral-600" /> Add public event from flyer
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          For events that are not yours and may not have a host on WhatsLocal. Review the extracted
          details before publishing to the public feed.
        </p>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {busy ?? (drafts.length ? "Scan another flyer" : "Take / upload flyer")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
          />
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {drafts.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Review {drafts.length} event{drafts.length === 1 ? "" : "s"}
            </p>
            {drafts.map((draft, index) => (
              <div key={index} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
                {draft.poster_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.poster_image_url}
                    alt=""
                    className="h-24 w-16 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={draft.title}
                    onChange={(event) => update(index, { title: event.target.value })}
                    placeholder="Title"
                    className="w-full rounded-md border border-stone-200 px-2 py-1 text-sm font-medium"
                  />
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <input
                      value={draft.event_date ?? ""}
                      onChange={(event) => update(index, { event_date: event.target.value })}
                      placeholder="Date as printed"
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    />
                    <input
                      value={draft.event_time ?? ""}
                      onChange={(event) => update(index, { event_time: event.target.value })}
                      placeholder="Time"
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <input
                    value={draft.location ?? ""}
                    onChange={(event) => update(index, { location: event.target.value })}
                    placeholder="Location"
                    className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                  />
                  <textarea
                    value={draft.description ?? ""}
                    onChange={(event) => update(index, { description: event.target.value })}
                    placeholder="Description"
                    rows={2}
                    className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDrafts((rows) => rows.filter((_, i) => i !== index))}
                  aria-label="Remove event"
                  className="text-stone-400 transition hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={publish}
                disabled={!!busy || drafts.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral-700 disabled:opacity-50"
              >
                {busy === "Publishing..." ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Publish to feed
              </button>
              <button
                type="button"
                onClick={() => setDrafts([])}
                disabled={!!busy}
                className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {created.length > 0 && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <Check className="h-4 w-4" /> Published {created.length} event
              {created.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-1 text-xs">
              {created.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-stone-700">{event.title}</span>
                  <Link
                    href={`/events/${event.id}`}
                    target="_blank"
                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-700 hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
