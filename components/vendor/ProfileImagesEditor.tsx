"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Star, X } from "lucide-react";

/**
 * The photos on a vendor's public page: add, reorder, remove.
 *
 * There was no way to do any of it. The gallery came from an import or from a
 * hardcoded list in lib/member-images, so the one screen called "Business
 * profile" could edit every word on the page and none of its pictures.
 *
 * ── Saves on every change, not on the page's Save button ──────────────────
 * Unlike the rest of this form. An upload has already crossed the network by
 * the time it appears here, so a list left unsaved is a photo the vendor
 * watched arrive and then lost by navigating away. Removing saves immediately
 * for the same reason it matters most: taking a picture down is usually
 * urgent.
 *
 * ── The first one is the cover ────────────────────────────────────────────
 * Order IS the meaning — every surface that shows a single photo takes the
 * first, and the server writes `imageUrl` from it. So "Make cover" moves an
 * image to the front rather than setting a separate flag that could disagree
 * with the list.
 */
export function ProfileImagesEditor({
  memberId,
  initialImages,
}: {
  memberId: string;
  initialImages: string[];
}) {
  const [images, setImages] = useState<string[]>(initialImages);
  // The authoritative list, readable synchronously.
  //
  // Every handler used to build its next list from the `images` CLOSURE, which
  // is a snapshot from the render it was created in. An upload takes seconds —
  // long enough for a removal, a "make cover", or a second batch to land first
  // — and when it finished it wrote `[...images, ...added]` from the list as it
  // was BEFORE any of that. The other change silently disappeared, and the
  // upload that "worked" was the one that happened to finish last.
  const imagesRef = useRef<string[]>(initialImages);
  const applyImages = (next: string[]) => {
    imagesRef.current = next;
    setImages(next);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function persist(next: string[]) {
    const previous = imagesRef.current;
    applyImages(next); // optimistic — the grid must feel like a grid
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}/about`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: next }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
    } catch {
      // Put it back. A photo that looks saved and isn't is worse than an error.
      applyImages(previous);
      setError("Couldn't save that change. Try again.");
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));

      // In PARALLEL. These were uploaded one at a time, so picking five photos
      // meant five full round trips end to end — each one a multi-megabyte
      // phone picture — and the whole wait happened before anything appeared.
      // They don't depend on each other, so they don't have to queue.
      const uploadOne = async (file: File) => {
        const form = new FormData();
        form.append("file", file);
        // The server resolves the actor anyway; this is what lets an admin act
        // on behalf of a member, exactly like every other vendor write.
        form.append("memberId", memberId);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.url) throw new Error(body?.error || "upload failed");
        return body.url as string;
      };

      // Promise.all keeps the results in the order they were picked, so the
      // cover ends up being the photo the vendor chose first rather than
      // whichever upload happened to finish first.
      const added = await Promise.all(picked.map(uploadOne));
      // From the REF, not the closure — see the note on imagesRef.
      if (added.length) await persist([...imagesRef.current, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <span className="block text-[13px] font-medium text-stone-600">Photos</span>
      <span className="mt-0.5 block text-[12px] leading-relaxed text-stone-400">
        The pictures at the top of your page. The first one is the cover — it&apos;s what shows on
        your card everywhere else.
      </span>

      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((src, i) => (
          <div
            key={src}
            className="group relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
          >
            <Image src={src} alt="" fill sizes="120px" className="object-cover" />

            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-stone-900/85 px-2 py-0.5 text-[10px] font-semibold text-white">
                Cover
              </span>
            )}

            <button
              onClick={() => persist(imagesRef.current.filter((u) => u !== src))}
              aria-label="Remove photo"
              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow transition hover:bg-white hover:text-rose-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {i > 0 && (
              <button
                onClick={() => persist([src, ...imagesRef.current.filter((u) => u !== src)])}
                className="absolute inset-x-1.5 bottom-1.5 inline-flex items-center justify-center gap-1 rounded-full bg-white/90 py-1 text-[11px] font-medium text-stone-700 shadow transition hover:bg-white"
              >
                <Star className="h-3 w-3" /> Cover
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 transition hover:border-stone-900 hover:text-stone-900 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[11px] font-medium">{busy ? "Uploading…" : "Add photos"}</span>
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => addFiles(e.target.files)}
        className="hidden"
      />

      {error && <p className="mt-2 text-[12px] text-rose-600">{error}</p>}
      {images.length === 0 && !busy && (
        <p className="mt-2 text-[12px] text-stone-400">
          No photos yet — your page shows a colour instead of a picture, and the Shops tab only
          lists businesses that have one.
        </p>
      )}
    </div>
  );
}
