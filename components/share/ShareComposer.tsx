"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Video, QrCode, X, Radio, Store, CalendarDays, Loader2 } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { listMembers, listEvents } from "@/lib/api";
import type { Member, EventSuggestion } from "@/lib/types";
import { DEMO_MEMBERS } from "@/lib/demo-members";

interface Media {
  url: string;
  kind: "image" | "video";
}

export function ShareComposer() {
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [livestreamUrl, setLivestreamUrl] = useState("");

  const [members, setMembers] = useState<Member[]>(() => DEMO_MEMBERS);
  const [events, setEvents] = useState<EventSuggestion[]>([]);
  const [bizQuery, setBizQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [taggedBiz, setTaggedBiz] = useState<{ id: string; name: string } | null>(null);
  const [taggedEvent, setTaggedEvent] = useState<{ id: string; title: string } | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listMembers({ limit: 100 })
      .then((r) => { if (!cancelled && r.members?.length) setMembers(r.members); })
      .catch(() => {});
    listEvents({ limit: 100 })
      .then((r) => { if (!cancelled && r.events?.length) setEvents(r.events); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const bizResults = useMemo(() => {
    const q = bizQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => (m.profile?.name ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [bizQuery, members]);

  const eventResults = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter((e) => (e.title ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [eventQuery, events]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/share/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) setMedia((m) => [...m, { url: data.url, kind: data.kind }]);
        else setError(data.error ?? "Upload failed");
      } catch {
        setError("Upload failed");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onScan(kind: "business" | "event", id: string) {
    if (kind === "event") {
      const e = events.find((x) => x.id === id);
      setTaggedEvent({ id, title: e?.title ?? "Event" });
    } else {
      const m = members.find((x) => x.id === id);
      setTaggedBiz({ id, name: m?.profile?.name ?? "Business" });
    }
    setScannerOpen(false);
  }

  async function submit() {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          imageUrls: media.filter((m) => m.kind === "image").map((m) => m.url),
          videoUrls: media.filter((m) => m.kind === "video").map((m) => m.url),
          taggedMemberId: taggedBiz?.id ?? null,
          taggedMemberName: taggedBiz?.name ?? null,
          taggedEventId: taggedEvent?.id ?? null,
          taggedEventTitle: taggedEvent?.title ?? null,
          livestreamUrl: livestreamUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setBody("");
        setMedia([]);
        setLivestreamUrl("");
        setTaggedBiz(null);
        setTaggedEvent(null);
        setPosted(true);
      } else {
        setError(data.error ?? "Failed to post");
      }
    } catch {
      setError("Failed to post");
    }
    setPosting(false);
  }

  const canPost = body.trim() || media.length > 0 || livestreamUrl.trim();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">Share</h1>

      {posted && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>Shared! 🎉</span>
          <button type="button" onClick={() => setPosted(false)} className="font-medium underline">
            Post another
          </button>
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="What's happening locally?"
        className="w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 text-base text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none"
      />

      {/* Media previews */}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              {m.kind === "image" ? (
                <Image src={m.url} alt="" fill sizes="33vw" className="object-cover" />
              ) : (
                <video src={m.url} className="h-full w-full object-cover" muted />
              )}
              <button
                type="button"
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

      {/* Action toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <ToolButton onClick={() => fileRef.current?.click()} icon={ImagePlus} label="Photo" />
        <ToolButton onClick={() => fileRef.current?.click()} icon={Video} label="Video" />
        <ToolButton onClick={() => setScannerOpen(true)} icon={QrCode} label="Scan QR" />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>

      {/* Livestream link */}
      <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
        <Radio className="h-4 w-4 shrink-0 text-rose-500" />
        <input
          value={livestreamUrl}
          onChange={(e) => setLivestreamUrl(e.target.value)}
          placeholder="Livestream link (YouTube / Twitch)"
          className="w-full bg-transparent py-2.5 text-base text-stone-900 placeholder-stone-400 focus:outline-none"
        />
      </label>

      {/* Tag a business */}
      <TagField
        icon={Store}
        placeholder="Tag a business"
        query={bizQuery}
        setQuery={setBizQuery}
        tagged={taggedBiz?.name}
        onClear={() => setTaggedBiz(null)}
        results={bizResults.map((m) => ({ id: m.id, label: m.profile?.name ?? "Business" }))}
        onSelect={(r) => { setTaggedBiz({ id: r.id, name: r.label }); setBizQuery(""); }}
        extra={
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            <QrCode className="h-3.5 w-3.5" /> Scan
          </button>
        }
      />

      {/* Tag an event */}
      <TagField
        icon={CalendarDays}
        placeholder="Tag an event"
        query={eventQuery}
        setQuery={setEventQuery}
        tagged={taggedEvent?.title}
        onClear={() => setTaggedEvent(null)}
        results={eventResults.map((e) => ({ id: e.id, label: e.title ?? "Event" }))}
        onSelect={(r) => { setTaggedEvent({ id: r.id, title: r.label }); setEventQuery(""); }}
        extra={
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            <QrCode className="h-3.5 w-3.5" /> Scan
          </button>
        }
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        disabled={!canPost || posting || uploading}
        onClick={submit}
        className="w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
      >
        {posting ? "Sharing…" : "Share"}
      </button>

      {scannerOpen && <ScannerModal onScan={onScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}

function ToolButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: typeof ImagePlus; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function TagField({
  icon: Icon, placeholder, query, setQuery, tagged, onClear, results, onSelect, extra,
}: {
  icon: typeof Store;
  placeholder: string;
  query: string;
  setQuery: (v: string) => void;
  tagged?: string;
  onClear: () => void;
  results: { id: string; label: string }[];
  onSelect: (r: { id: string; label: string }) => void;
  extra?: React.ReactNode;
}) {
  if (tagged) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
        <Icon className="h-4 w-4 text-indigo-500" />
        <span className="flex-1 truncate text-sm font-medium text-stone-800">{tagged}</span>
        <button type="button" onClick={onClear} aria-label="Remove tag" className="text-stone-400 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
        <Icon className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 text-base text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        {extra}
      </div>
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className="block w-full truncate px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScannerModal({
  onScan,
  onClose,
}: {
  onScan: (kind: "business" | "event", id: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (res) => {
          if (res && !cancelled) {
            try {
              const u = new URL(res.getText());
              const biz = u.pathname.match(/\/members\/([^/]+)/);
              const evt = u.pathname.match(/\/(?:events|live)\/([^/]+)/);
              if (biz) {
                controlsRef.current?.stop();
                onScan("business", biz[1]);
              } else if (evt) {
                controlsRef.current?.stop();
                onScan("event", evt[1]);
              }
            } catch {
              /* ignore non-URL codes */
            }
          }
        });
        controlsRef.current = controls;
      } catch {
        if (!cancelled) setError("Camera unavailable. Needs HTTPS or localhost.");
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onScan]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 px-4 pb-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex justify-end pr-1">
        <button onClick={onClose} aria-label="Close scanner" className="rounded-full bg-white/20 p-2.5 text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {error ? (
          <p className="max-w-xs text-center text-sm text-white/80">{error}</p>
        ) : (
          <video ref={videoRef} className="max-h-[70vh] w-full max-w-sm rounded-2xl object-cover" muted playsInline />
        )}
      </div>
      <p className="pb-4 text-center text-sm text-white/70">Scan a business or event QR code to tag it</p>
    </div>
  );
}
