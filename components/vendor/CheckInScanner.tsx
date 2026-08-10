"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { CheckCircle2, XCircle, CameraOff, Search, RotateCcw, Users } from "lucide-react";
import { nativeScanAvailable, scanNativeQr } from "@/lib/native-scan";

interface DoorTicket {
  id: string;
  code: string;
  name: string | null;
  email: string | null;
  typeName: string | null;
  status: string;
  checkedInAt: string | null;
}

type Verdict = {
  ok: boolean;
  message: string;
  who: string | null;
  detail: string | null;
  at: number;
};

/**
 * The door.
 *
 * Two things drive every decision here: it is used standing up, in bad light,
 * with a queue forming — and a WRONG "yes" costs more than a slow "no". So the
 * verdict is a full-bleed colour wash readable at arm's length, a repeat scan
 * is loudly refused rather than silently accepted, and the camera keeps running
 * between scans so the next person can step straight up.
 */
export function CheckInScanner({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [issued, setIssued] = useState(0);
  const [checkedIn, setCheckedIn] = useState(0);
  const [tickets, setTickets] = useState<DoorTicket[]>([]);
  const [manual, setManual] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // The same code scanning twice in a row is one person holding their phone
  // still, not two entries — swallow it for a moment so the camera doesn't
  // fire "already checked in" at someone who was just admitted.
  const lastScan = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const apply = useCallback((d: { issued?: number; checkedIn?: number; tickets?: DoorTicket[] }) => {
    setIssued(d.issued ?? 0);
    setCheckedIn(d.checkedIn ?? 0);
    setTickets(Array.isArray(d.tickets) ? d.tickets : []);
  }, []);

  const refresh = useCallback(() => {
    fetch(`/api/vendor/events/${eventId}/checkin`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && apply(d))
      .catch(() => {});
  }, [eventId, apply]);

  useEffect(refresh, [refresh]);

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || busy) return;
      const now = Date.now();
      if (trimmed === lastScan.current.value && now - lastScan.current.at < 3000) return;
      lastScan.current = { value: trimmed, at: now };

      setBusy(true);
      try {
        const res = await fetch(`/api/vendor/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: trimmed }),
        });
        const d = await res.json();
        setVerdict({
          ok: !!d.ok,
          message: d.ok ? "Come on in" : (d.message ?? "Not valid"),
          who: d.ticket?.name ?? null,
          detail: d.ticket?.typeName ?? d.ticket?.code ?? null,
          at: Date.now(),
        });
        if (typeof d.checkedIn === "number") setCheckedIn(d.checkedIn);
        if (navigator.vibrate) navigator.vibrate(d.ok ? 40 : [60, 60, 60]);
        refresh();
      } catch {
        setVerdict({ ok: false, message: "Couldn't reach the server", who: null, detail: null, at: Date.now() });
      } finally {
        setBusy(false);
      }
    },
    [eventId, busy, refresh]
  );

  // Clear the verdict after a beat so the scanner is ready for the next person
  // without anyone having to tap.
  useEffect(() => {
    if (!verdict) return;
    const t = setTimeout(() => setVerdict(null), verdict.ok ? 2200 : 4000);
    return () => clearTimeout(t);
  }, [verdict]);

  async function undo(id: string) {
    await fetch(`/api/vendor/events/${eventId}/checkin?id=${id}`, { method: "DELETE" });
    refresh();
  }

  const filtered = query.trim()
    ? tickets.filter((t) =>
        [t.name, t.email, t.code].some((f) => (f ?? "").toLowerCase().includes(query.trim().toLowerCase()))
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{eventTitle}</p>
          <p className="text-xs text-stone-500">Scan tickets at the door</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums text-stone-900">
            {checkedIn}
            <span className="text-base font-medium text-stone-400">/{issued}</span>
          </p>
          <p className="flex items-center justify-end gap-1 text-xs text-stone-500">
            <Users className="h-3 w-3" /> in
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-stone-900">
        <Camera onDecoded={submit} />
        {verdict && (
          <div
            className={
              "absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center " +
              (verdict.ok ? "bg-emerald-500" : "bg-rose-600")
            }
          >
            {verdict.ok ? (
              <CheckCircle2 className="h-16 w-16 text-white" />
            ) : (
              <XCircle className="h-16 w-16 text-white" />
            )}
            <p className="text-2xl font-bold text-white">{verdict.message}</p>
            {verdict.who && <p className="text-lg font-medium text-white/90">{verdict.who}</p>}
            {verdict.detail && <p className="text-sm text-white/75">{verdict.detail}</p>}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(manual);
          setManual("");
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Type a ticket code"
          autoCapitalize="characters"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2.5 font-mono text-sm tracking-wider"
        />
        <button
          type="submit"
          disabled={!manual.trim() || busy}
          className="shrink-0 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Check in
        </button>
      </form>

      {/* The no-phone, no-email case: find them by name and admit by hand. */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <Search className="h-4 w-4 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Look someone up by name or email"
            className="min-w-0 flex-1 border-0 p-0 text-sm outline-none placeholder:text-stone-400"
          />
        </label>

        {query.trim() && (
          <ul className="mt-3 space-y-1.5">
            {filtered.length === 0 && <li className="text-sm text-stone-500">No one matches.</li>}
            {filtered.slice(0, 20).map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">{t.name ?? t.email ?? "Guest"}</p>
                  <p className="truncate font-mono text-xs text-stone-500">
                    {t.code}
                    {t.typeName ? ` · ${t.typeName}` : ""}
                  </p>
                </div>
                {t.status === "checked_in" ? (
                  <button
                    onClick={() => undo(t.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200"
                  >
                    <RotateCcw className="h-3 w-3" /> Undo
                  </button>
                ) : (
                  <button
                    onClick={() => submit(t.code)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Check in
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Live camera, kept running between scans. Mirrors the QrScanButton approach:
// zxing in the WKWebView (Capacitor grants it camera), native scanner offered
// only when getUserMedia actually fails.
function Camera({ onDecoded }: { onDecoded: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access is unavailable here.");
          return;
        }
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (res) => {
          // Note: no stop() here — the door scans one person after another, and
          // tearing the camera down after each would cost a restart per guest.
          if (res && !cancelled) onDecoded(res.getText());
        });
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (e) {
        const err = e as { name?: string; message?: string };
        setError(
          err.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it and reload."
            : err.name === "NotFoundError"
              ? "No camera on this device."
              : `Couldn't start the camera (${err.name || "error"}).`
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDecoded]);

  return (
    <div className="relative aspect-[4/3] w-full">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      {!error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-40 w-40 rounded-2xl border-2 border-white/70" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-stone-200">
          <CameraOff className="h-8 w-8 text-stone-400" />
          <p>{error}</p>
          {nativeScanAvailable() && (
            <button
              onClick={async () => {
                try {
                  onDecoded(await scanNativeQr());
                } catch {
                  /* cancelled */
                }
              }}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Use the camera app
            </button>
          )}
        </div>
      )}
    </div>
  );
}
