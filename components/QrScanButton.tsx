'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, X, ExternalLink, CameraOff, ScanLine } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'
import { nativeScanAvailable, scanNativeQr } from '@/lib/native-scan'

// LinkedIn-style code sheet: camera QR scan that
// both route a marketplace profile URL in-app. Independent of any QR-generation
// code. Camera needs HTTPS/localhost; Web NFC needs Chrome on Android over HTTPS.
type Decoded =
  | { kind: 'profile'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'text'; value: string }

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
        aria-label="Scan a code"
        title="Scan a code"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
      >
        <QrCode className="h-5 w-5" />
      </button>
      {open && <CodeSheet onClose={() => setOpen(false)} />}
    </>
  )
}

function CodeSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [result, setResult] = useState<ShownResult | null>(null)

  // Shared: a profile navigates immediately; anything else is shown.
  const handleDecoded = useCallback(
    (raw: string) => {
      const d = classify(raw)
      if (d.kind === 'profile') {
        router.push(d.path)
        onClose()
      } else {
        setResult(d)
      }
    },
    [router, onClose]
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-stone-100">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-stone-900">Scan a code</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {result ? (
          <ResultPanel result={result} onAgain={() => setResult(null)} />
        ) : (
          <ScanPanel onDecoded={handleDecoded} />
        )}
      </div>
    </div>
  )
}

// ── Scan tab (camera QR via zxing, embedded in the sheet — LinkedIn-style) ────
// Capacitor's WKWebView grants camera to web content, so the embedded <video>
// preview works inside the iOS app too. If getUserMedia ever fails and the native
// scanner is available, we offer it as a full-screen fallback.
function ScanPanel({ onDecoded }: { onDecoded: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera access is unavailable here.')
          return
        }
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        if (!videoRef.current) return
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (res) => {
          if (res && !cancelled) {
            controlsRef.current?.stop()
            onDecoded(res.getText())
          }
        })
        if (cancelled) controls.stop()
        else controlsRef.current = controls
      } catch (e) {
        const err = e as { name?: string; message?: string }
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow camera access and try again.'
            : err.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : `Couldn't start the camera (${err.name || 'error'}: ${err.message || 'unknown'}).`
        )
      }
    }
    start()
    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onDecoded])

  async function nativeFallback() {
    try {
      onDecoded(await scanNativeQr())
    } catch {
      /* cancel/no-code — stay on the error panel */
    }
  }

  return (
    <>
      <div className="relative aspect-square bg-stone-900">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-stone-200">
            <CameraOff className="h-8 w-8 text-stone-400" />
            {error}
            {nativeScanAvailable() && (
              <button
                type="button"
                onClick={nativeFallback}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-stone-900 hover:bg-white/90"
              >
                <ScanLine className="h-4 w-4" /> Open camera
              </button>
            )}
          </div>
        )}
      </div>
      {!error && <p className="px-4 py-3 text-center text-xs text-stone-400">Point your camera at a QR code.</p>}
    </>
  )
}

function ResultPanel({ result, onAgain }: { result: ShownResult; onAgain: () => void }) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-stone-600">{result.kind === 'external' ? 'Found a link:' : 'Found:'}</p>
      <p className="break-all rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">
        {result.kind === 'external' ? result.url : result.value}
      </p>
      <div className="flex gap-2">
        {result.kind === 'external' && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700"
          >
            Open link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button type="button" onClick={onAgain} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-100">
          Try again
        </button>
      </div>
    </div>
  )
}
