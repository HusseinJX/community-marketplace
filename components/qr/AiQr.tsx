'use client'

import { useState } from 'react'
import { Sparkles, Download, Wand2 } from 'lucide-react'

// Tier 1 UI — only mounted when NEXT_PUBLIC_QR_AI is on (the page decides).
// Independent of BasicQr; if generation fails the user still has the basic tab.
const STYLES = [
  { key: 'botanical', label: 'Botanical' },
  { key: 'neon', label: 'Neon' },
  { key: 'watercolor', label: 'Watercolor' },
  { key: 'retro', label: 'Retro' },
  { key: 'marble', label: 'Marble' },
]

export function AiQr({ businessName }: { businessName: string }) {
  const [style, setStyle] = useState('botanical')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'business'

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/vendor/qr/stylize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setUrl(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!url) return
    try {
      const blob = await fetch(url).then((r) => r.blob())
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = `${slug}-qr-styled.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(obj)
    } catch {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="card-soft p-4">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <p className="section-label">Stylized with AI</p>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">Beta</span>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex h-52 w-52 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Stylized QR code for ${businessName}`} className="h-full w-full object-cover" />
          ) : (
            <Wand2 className={`h-10 w-10 text-stone-300 ${busy ? 'animate-pulse' : ''}`} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="section-label mb-2">Style</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  className={
                    'rounded-full px-3 py-1.5 text-xs font-medium transition ' +
                    (style === s.key ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300')
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional: add a detail, e.g. 'with coffee beans'"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={generate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {busy ? 'Generating…' : url ? 'Regenerate' : 'Generate'}
            </button>
            {url && (
              <button
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
              >
                <Download className="h-4 w-4" /> Download PNG
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error} — the basic QR above always works.</p>}
          <p className="text-xs text-stone-400">
            The real QR is laid over an AI background, so it always scans. Takes ~10–20s.
          </p>
        </div>
      </div>
    </div>
  )
}
