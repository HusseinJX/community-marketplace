'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, X, ExternalLink, CameraOff } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'

// Independent client feature — depends on no QR-generation code. Opens the
// camera, scans a QR, and routes to the member profile it encodes. A scanned
// code that isn't a marketplace profile is shown with an explicit open link.
type Decoded =
  | { kind: 'profile'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'text'; value: string }

// A profile scan navigates immediately, so it's never held in state — only
// these two kinds are ever displayed.
type ShownResult = Exclude<Decoded, { kind: 'profile' }>

function classify(raw: string): Decoded {
  try {
    const u = new URL(raw)
    if (u.pathname.startsWith('/members/')) {
      return { kind: 'profile', path: u.pathname + u.search }
    }
    return { kind: 'external', url: u.toString() }
  } catch {
    return { kind: 'text', value: raw }
  }
}

export function QrScanButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan a QR code"
        title="Scan a QR code"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
      >
        <QrCode className="h-5 w-5" />
      </button>
      {open && <ScannerModal onClose={() => setOpen(false)} />}
    </>
  )
}

function ScannerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShownResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        if (!videoRef.current) return
        // Prefer the rear camera on phones.
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (res) => {
            if (res && !cancelled) {
              const decoded = classify(res.getText())
              if (decoded.kind === 'profile') {
                controlsRef.current?.stop()
                router.push(decoded.path)
                onClose()
              } else {
                setResult(decoded)
              }
            }
          }
        )
        if (cancelled) controls.stop()
        else controlsRef.current = controls
      } catch (e) {
        const name = (e as { name?: string })?.name
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow camera access and try again.'
            : name === 'NotFoundError'
              ? 'No camera found on this device.'
              : "Couldn't start the camera. Try a different browser."
        )
      }
    }

    start()
    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [router, onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <QrCode className="h-4 w-4" /> Scan a QR code
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-square bg-stone-900">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {!error && !result && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-stone-200">
              <CameraOff className="h-8 w-8 text-stone-400" />
              {error}
            </div>
          )}
        </div>

        {result ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-stone-600">
              {result.kind === 'external' ? 'Scanned a link:' : 'Scanned:'}
            </p>
            <p className="break-all rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">
              {result.kind === 'external' ? result.url : result.value}
            </p>
            <div className="flex gap-2">
              {result.kind === 'external' && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Open link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => setResult(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Scan again
              </button>
            </div>
          </div>
        ) : (
          !error && <p className="px-4 py-3 text-center text-xs text-stone-400">Point your camera at a QR code.</p>
        )}
      </div>
    </div>
  )
}
