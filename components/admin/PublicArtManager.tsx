"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  Loader2,
  MapPin,
  Palette,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

interface Artist {
  id: string;
  name: string;
  detail?: string;
}

/**
 * Add a piece of public art and credit everyone who made it.
 *
 * Super-admin only. Walk up to a mural, photograph it, tag where you are, name
 * the artists — picking the ones already here and creating the ones who aren't
 * without leaving the screen. The post is authored by the admin; the artists
 * are tagged, so the same mural appears on every one of their profiles, and an
 * artist on two walls has both on theirs.
 */
export function PublicArtManager() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [body, setBody] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; artists: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ask for the fix as soon as the tool opens: by the time the photo and the
  // artists are in, the phone has usually settled on a good one, and asking at
  // submit-time means waiting in front of the wall.
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/share/upload", { method: "POST", body: form });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Upload failed");
        if (d.url) setImageUrls((u) => [...u, d.url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function post() {
    if (!imageUrls.length) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls,
          body,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          location: locationLabel.trim() || null,
          artists: artists.map((a) => ({ id: a.id, name: a.name })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not post");
      setDone({ id: d.post?.id ?? "", artists: d.artists ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post");
    } finally {
      setPosting(false);
    }
  }

  function reset() {
    setImageUrls([]);
    setBody("");
    setArtists([]);
    setLocationLabel("");
    setDone(null);
    setError(null);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50">
          <Check className="h-5 w-5 text-emerald-600" />
        </span>
        <p className="mt-3 text-sm font-semibold text-stone-950">
          Posted, crediting {done.artists} {done.artists === 1 ? "artist" : "artists"}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          It&apos;s on each of their profiles now.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Add another
          </button>
          <Link
            href="/?tab=feed"
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            See the feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-stone-900">Add public artwork</h3>
      </div>

      {/* ── The photo ──────────────────────────────────────────────────── */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => void upload(e.target.files)}
          className="hidden"
        />
        {imageUrls.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {imageUrls.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => setImageUrls((u) => u.filter((x) => x !== url))}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grid aspect-square place-items-center rounded-lg border border-dashed border-stone-300 text-stone-400 hover:border-stone-400"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-stone-500 transition hover:border-stone-400 hover:bg-stone-50"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Camera className="h-6 w-6 text-stone-400" />
            )}
            <span className="text-sm font-semibold">Photograph the artwork</span>
          </button>
        )}
      </div>

      {/* ── Where it is ────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-stone-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600">
            <MapPin className="h-3.5 w-3.5" />
            {locating
              ? "Finding you…"
              : coords
                ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                : "No location"}
          </span>
          {!coords && !locating && (
            <button
              onClick={() => {
                setLocating(true);
                navigator.geolocation?.getCurrentPosition(
                  (p) => {
                    setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
                    setLocating(false);
                  },
                  () => setLocating(false),
                  { enableHighAccuracy: true, timeout: 10_000 },
                );
              }}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Use my location
            </button>
          )}
        </div>
        <input
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
          placeholder="Corner or street (optional — we'll look it up)"
          className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none"
        />
      </div>

      {/* ── Who made it ────────────────────────────────────────────────── */}
      <ArtistPicker artists={artists} onChange={setArtists} />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Anything about the piece (optional)"
        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={() => void post()}
        disabled={posting || !imageUrls.length}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
      >
        {posting && <Loader2 className="h-4 w-4 animate-spin" />}
        {artists.length
          ? `Post, crediting ${artists.length} ${artists.length === 1 ? "artist" : "artists"}`
          : "Post without a credit"}
      </button>
      {!artists.length && imageUrls.length > 0 && (
        <p className="-mt-2 text-center text-xs text-stone-400">
          You can post an uncredited piece, but the artist page is the point.
        </p>
      )}
    </div>
  );
}

/**
 * Type a name: pick the artist if they're here, create them if they aren't.
 *
 * The create path can run a web search first and show what it found BEFORE
 * writing the profile — same shape as the canvass tool, and for the same
 * reason: a profile made from nothing is a name on an empty page.
 */
function ArtistPicker({
  artists,
  onChange,
}: {
  artists: Artist[];
  onChange: (next: Artist[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Artist[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [research, setResearch] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [notes, setNotes] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Debounced, because this one is ours (the connector's search), not Google's
  // — no per-keystroke bill, and a picker that waits for a button is a picker
  // nobody uses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/artists?q=${encodeURIComponent(q)}`);
        const d = await res.json();
        setResults(d.artists ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const add = (a: Artist) => {
    if (!artists.some((x) => x.id === a.id)) onChange([...artists, a]);
    setQuery("");
    setResults(null);
    setShowCreate(false);
    setResearch(null);
    setNotes("");
  };

  async function preview() {
    setResearching(true);
    try {
      const res = await fetch("/api/admin/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: query.trim(), preview: true }),
      });
      const d = await res.json();
      setResearch(d.research ?? "");
    } catch {
      setResearch("");
    } finally {
      setResearching(false);
    }
  }

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: query.trim(),
          notes,
          // Only research on create if we haven't already: a second search
          // would be a second bill for an answer already on screen.
          research: research === null,
        }),
      });
      const d = await res.json();
      if (d.id) add({ id: d.id, name: d.name, detail: "just created" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-stone-600">Artists</label>

      {artists.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {artists.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-xs font-semibold text-indigo-700"
            >
              {a.name}
              <button
                onClick={() => onChange(artists.filter((x) => x.id !== a.id))}
                aria-label={`Remove ${a.name}`}
                className="rounded-full p-0.5 hover:bg-indigo-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowCreate(false);
            setResearch(null);
          }}
          placeholder="Type an artist's name"
          className="w-full rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />
        )}
      </div>

      {results !== null && query.trim().length >= 2 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-stone-200">
          {results.map((a) => (
            <button
              key={a.id}
              onClick={() => add(a)}
              className="flex w-full items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-900">{a.name}</span>
                {a.detail && <span className="block truncate text-xs text-stone-500">{a.detail}</span>}
              </span>
              <Plus className="h-4 w-4 shrink-0 text-stone-400" />
            </button>
          ))}

          {/* Always offered, even when there are matches — the artist you mean
              may simply not be one of them. */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 bg-stone-50 px-3 py-2 text-left text-sm font-semibold text-indigo-700 hover:bg-stone-100"
          >
            <Plus className="h-4 w-4" />
            Create &ldquo;{query.trim()}&rdquo; as a new artist
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mt-2 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
          <p className="text-sm font-semibold text-stone-900">New artist: {query.trim()}</p>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything you know about them (optional)"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder-stone-400 focus:outline-none"
          />

          {research === null ? (
            <button
              onClick={() => void preview()}
              disabled={researching}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50"
            >
              {researching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Search the web for them
            </button>
          ) : research ? (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-white p-3 text-xs leading-relaxed text-stone-700">
              {research}
            </div>
          ) : (
            <p className="text-xs text-stone-500">
              Nothing found. You can still create them from the name.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => void create()}
              disabled={creating}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create and tag
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setResearch(null);
              }}
              className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
