'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, X, ExternalLink, CameraOff, Nfc, ScanLine, Radio } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'
import { nativeNfcAvailable, scanNativeNfc } from '@/lib/native-nfc'
import { nativeScanAvailable, scanNativeQr } from '@/lib/native-scan'

// LinkedIn-style code sheet: two tabs — "NFC tag" (default) and "Scan" — that
// both route a marketplace profile URL in-app. Independent of any QR-generation
// code. Camera needs HTTPS/localhost; Web NFC needs Chrome on Android over HTTPS.
type Decoded =
  | { kind: 'profile'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'text'; value: string }

type ShownResult = Exclude<Decoded, { kind: 'profile' }>
type Tab = 'nfc' | 'scan'

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
  const [tab, setTab] = useState<Tab>('scan')
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
        {/* Header + tabs */}
        <div className="border-b border-stone-100">
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-sm font-semibold text-stone-900">Connect</span>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex px-2">
            <TabBtn active={tab === 'nfc'} onClick={() => { setTab('nfc'); setResult(null) }} icon={<Nfc className="h-4 w-4" />}>
              NFC tag
            </TabBtn>
            <TabBtn active={tab === 'scan'} onClick={() => { setTab('scan'); setResult(null) }} icon={<ScanLine className="h-4 w-4" />}>
              Scan
            </TabBtn>
          </div>
        </div>

        {result ? (
          <ResultPanel result={result} onAgain={() => setResult(null)} />
        ) : tab === 'nfc' ? (
          <NfcPanel onDecoded={handleDecoded} />
        ) : (
          <ScanPanel onDecoded={handleDecoded} />
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        active ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

// ── NFC tab (Web NFC / NDEFReader) ──────────────────────────────────────────
interface NdefRecord {
  recordType: string
  encoding?: string
  data?: BufferSource
}
interface NdefReadingEvent {
  message: { records: NdefRecord[] }
}
type NdefReader = {
  scan: (opts?: { signal?: AbortSignal }) => Promise<void>
  addEventListener: (type: 'reading' | 'readingerror', cb: (e: NdefReadingEvent) => void) => void
}

function NfcPanel({ onDecoded }: { onDecoded: (raw: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'unsupported' | 'scanning' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-start on iOS native as soon as the tab opens (the tab tap is the user
  // gesture that presents the system NFC sheet). Web NFC's scan() requires a
  // direct user gesture, so there we keep the Start button. Abort on unmount.
  useEffect(() => {
    if (nativeNfcAvailable()) start()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    // Native iOS shell (Core NFC) takes priority — Web NFC doesn't exist on iOS.
    if (nativeNfcAvailable()) {
      setStatus('scanning')
      setError(null)
      try {
        const value = await scanNativeNfc()
        onDecoded(value)
      } catch (e) {
        const msg = (e as { message?: string })?.message || ''
        // A user cancel returns to idle quietly; real errors surface.
        setStatus('idle')
        if (msg && !/cancel/i.test(msg)) setError("Couldn't read that tag — try again.")
      }
      return
    }

    const Ctor = (window as unknown as { NDEFReader?: new () => NdefReader }).NDEFReader
    if (!Ctor) {
      setStatus('unsupported')
      return
    }
    try {
      const reader = new Ctor()
      const ac = new AbortController()
      abortRef.current = ac
      await reader.scan({ signal: ac.signal })
      setStatus('scanning')
      setError(null)
      reader.addEventListener('reading', (e: NdefReadingEvent) => {
        for (const rec of e.message.records) {
          if ((rec.recordType === 'url' || rec.recordType === 'text') && rec.data) {
            try {
              const text = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data)
              if (text) {
                ac.abort()
                onDecoded(text)
                return
              }
            } catch {
              /* try next record */
            }
          }
        }
      })
      reader.addEventListener('readingerror', () => setError("Couldn't read that tag — try again."))
    } catch (e) {
      const name = (e as { name?: string })?.name
      setStatus('error')
      setError(
        name === 'NotAllowedError'
          ? 'NFC permission was blocked. Allow it and try again.'
          : "Couldn't start NFC. Make sure NFC is on."
      )
    }
  }

  if (status === 'unsupported') {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Nfc className="h-10 w-10 text-stone-300" />
        <p className="text-sm font-medium text-stone-800">NFC isn&apos;t available here</p>
        <p className="text-xs text-stone-500">
          Web NFC needs Chrome on Android over HTTPS. Use the <b>Scan</b> tab to read a QR code instead.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className={`relative flex h-28 w-28 items-center justify-center rounded-full ${status === 'scanning' ? 'bg-emerald-50' : 'bg-stone-100'}`}>
        {status === 'scanning' && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" />}
        <Nfc className={`relative h-12 w-12 ${status === 'scanning' ? 'text-emerald-600' : 'text-stone-400'}`} />
      </div>
      {status === 'scanning' ? (
        <>
          <p className="text-sm font-medium text-stone-800">Ready — hold a tag to your phone</p>
          <p className="text-xs text-stone-500">Tap an NFC tag to open that profile.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-stone-800">Tap to share & read with NFC</p>
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
          >
            <Radio className="h-4 w-4" /> Start NFC
          </button>
          <p className="text-xs text-stone-400">Tap Start, then hold a tag to your phone.</p>
        </>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-stone-200">
            <CameraOff className="h-8 w-8 text-stone-400" />
            {error}
            {nativeScanAvailable() && (
              <button
                type="button"
                onClick={nativeFallback}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-white/90"
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button type="button" onClick={onAgain} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
          Try again
        </button>
      </div>
    </div>
  )
}
