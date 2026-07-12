"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Link2, QrCode, Check, Download, X } from "lucide-react";
import { qrPngDataUrl, qrSvgString } from "@/lib/qr";

// Reusable share control: a "Share" button that opens a small menu with
// Copy link + Show QR (and the native share sheet when available). The QR modal
// downloads PNG/SVG so a vendor can print it for the event. `url` defaults to the
// current page, so most callers just pass a title.
export function ShareMenu({
  title,
  url,
  label = "Share",
  className,
}: {
  title?: string;
  url?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [href, setHref] = useState(url ?? "");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Resolve the current URL on the client when none was passed.
  useEffect(() => {
    if (!url && typeof window !== "undefined") setHref(window.location.href);
  }, [url]);

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, url: href || window.location.href }).catch(() => {});
      setOpen(false);
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div ref={wrapRef} className={"relative " + (className ?? "")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:text-indigo-700"
      >
        <Share2 className="size-4" /> {label}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <MenuItem icon={copied ? Check : Link2} label={copied ? "Copied!" : "Copy link"} onClick={copyLink} />
          <MenuItem icon={QrCode} label="Show QR code" onClick={() => { setQrOpen(true); setOpen(false); }} />
          {canNativeShare && <MenuItem icon={Share2} label="Share via…" onClick={nativeShare} />}
        </div>
      )}

      {qrOpen && <QrModal url={href || (typeof window !== "undefined" ? window.location.href : "")} title={title} onClose={() => setQrOpen(false)} />}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Link2; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
    >
      <Icon className="size-4 text-stone-500" /> {label}
    </button>
  );
}

function download(filename: string, data: string) {
  const a = document.createElement("a");
  a.href = data;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function QrModal({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const [png, setPng] = useState("");
  const slug = (title || "share").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "share";

  useEffect(() => {
    let live = true;
    qrPngDataUrl(url, { size: 512 })
      .then((d) => live && setPng(d))
      .catch(() => live && setPng(""));
    return () => {
      live = false;
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-900">{title ? `Scan for ${title}` : "Scan to open"}</p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="size-5" />
          </button>
        </div>
        <div className="mx-auto flex h-60 w-60 items-center justify-center rounded-xl border border-stone-200 bg-white p-3">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={png} alt="QR code" className="h-full w-full" />
          ) : (
            <QrCode className="h-10 w-10 text-stone-300" />
          )}
        </div>
        <p className="mt-3 truncate text-xs text-stone-400">{url}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={async () => download(`${slug}-qr.png`, await qrPngDataUrl(url, { size: 1024 }))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Download className="size-4" /> PNG
          </button>
          <button
            onClick={async () => download(`${slug}-qr.svg`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await qrSvgString(url))}`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            <Download className="size-4" /> SVG
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-400">SVG stays sharp for print.</p>
      </div>
    </div>
  );
}
