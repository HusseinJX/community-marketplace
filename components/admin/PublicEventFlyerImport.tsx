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
  venue_name: string | null;
  venue_address: string | null;
  price: string | null;
  age_limit: string | null;
  ticket_url: string | null;
  instagram: string | null;
  phone: string | null;
  artists_or_vendors: string[];
  notes: string | null;
  raw_text: string | null;
  poster_image_url: string | null;
  useVenue?: boolean;
  venueResolution?: {
    flyerVenueName: string | null;
    flyerAddress: string | null;
    query: string | null;
    confidence: "none" | "low" | "medium" | "high";
    existingMemberId: string | null;
    candidate: {
      placeId: string;
      name: string;
      address: string | null;
      city: string | null;
      neighborhood: string | null;
      lat: number | null;
      lng: number | null;
      phone: string | null;
      website: string | null;
      summary: string | null;
      rating: number | null;
      userRatingsTotal: number | null;
    } | null;
  } | null;
}

interface CreatedEvent {
  id: string;
  title: string;
}

interface CreatedVenue {
  id: string;
  name: string;
}

export function PublicEventFlyerImport({ ownerMemberId }: { ownerMemberId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [created, setCreated] = useState<CreatedEvent[]>([]);
  const [createdVenues, setCreatedVenues] = useState<CreatedVenue[]>([]);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setCreated([]);
    setCreatedVenues([]);
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

      setBusy("Finding venue...");
      const resolved = await fetch("/api/admin/public-event-flyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", events }),
      });
      const resolvedBody = await resolved.json().catch(() => ({}));
      if (!resolved.ok) throw new Error(resolvedBody.error || "Could not resolve the venue");
      setDrafts(
        ((resolvedBody.events ?? []) as EventDraft[]).map((draft) => ({
          ...draft,
          useVenue:
            !!draft.venueResolution?.candidate &&
            (draft.venueResolution.confidence === "high" || draft.venueResolution.confidence === "medium"),
        })),
      );
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
      setCreatedVenues(body.createdVenues ?? []);
      setDrafts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const toggleVenue = (index: number) =>
    setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, useVenue: !row.useVenue } : row)));

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
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <input
                      value={draft.venue_name ?? ""}
                      onChange={(event) => update(index, { venue_name: event.target.value })}
                      placeholder="Venue name from flyer"
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    />
                    <input
                      value={draft.venue_address ?? ""}
                      onChange={(event) => update(index, { venue_address: event.target.value })}
                      placeholder="Venue address from flyer"
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    />
                  </div>
                  {draft.venueResolution?.candidate ? (
                    <div className="rounded-lg border border-sky-100 bg-sky-50 p-2 text-xs text-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Google match: {draft.venueResolution.candidate.name}
                          </p>
                          {draft.venueResolution.candidate.address && (
                            <p className="mt-0.5 text-slate-600">{draft.venueResolution.candidate.address}</p>
                          )}
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                            {draft.venueResolution.existingMemberId ? "Existing profile" : "Create unclaimed profile"} ·{" "}
                            {draft.venueResolution.confidence} confidence
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleVenue(index)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                            draft.useVenue
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {draft.useVenue ? "Use venue" : "Use generic"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
                      No confident Google venue match. This will publish under Community flyer unless you edit and rescan.
                    </div>
                  )}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <input
                      value={draft.price ?? ""}
                      onChange={(event) => update(index, { price: event.target.value })}
                      placeholder="Price / cover"
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    />
                    <input
                      value={draft.age_limit ?? ""}
                      onChange={(event) => update(index, { age_limit: event.target.value })}
                      placeholder="Age limit"
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <textarea
                    value={draft.description ?? ""}
                    onChange={(event) => update(index, { description: event.target.value })}
                    placeholder="Description"
                    rows={2}
                    className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600"
                  />
                  <textarea
                    value={draft.raw_text ?? ""}
                    onChange={(event) => update(index, { raw_text: event.target.value })}
                    placeholder="All visible flyer text"
                    rows={2}
                    className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500"
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
            {createdVenues.length > 0 && (
              <p className="text-xs text-emerald-800">
                Created {createdVenues.length} venue profile
                {createdVenues.length === 1 ? "" : "s"}:{" "}
                {createdVenues.map((venue) => venue.name).join(", ")}
              </p>
            )}
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
