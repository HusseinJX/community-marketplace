'use client'

import { useEffect, useState } from 'react'
import { Download, QrCode } from 'lucide-react'
import { qrPngDataUrl, qrSvgString, type QrStyle } from '@/lib/qr'

// Tier 0 — basic QR generator. Entirely client-side: no AI, no API call.
const PRESETS: { label: string; dark: string; light: string }[] = [
  { label: 'Classic', dark: '#0c0a09', light: '#ffffff' },
  { label: 'Indigo', dark: '#4f46e5', light: '#ffffff' },
  { label: 'Emerald', dark: '#047857', light: '#ffffff' },
  { label: 'Inverted', dark: '#ffffff', light: '#0c0a09' },
]

function downloadString(filename: string, data: string) {
  const a = document.createElement('a')
  a.href = data
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function BasicQr({ url, businessName }: { url: string; businessName: string }) {
  const [style, setStyle] = useState<QrStyle>({ dark: PRESETS[0].dark, light: PRESETS[0].light })
  const [png, setPng] = useState<string>('')

  useEffect(() => {
    let live = true
    qrPngDataUrl(url, { ...style, size: 512 })
      .then((d) => live && setPng(d))
      .catch(() => live && setPng(''))
    return () => {
      live = false
    }
  }, [url, style])

  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'business'

  async function downloadPng() {
    const data = await qrPngDataUrl(url, { ...style, size: 1024 })
    downloadString(`${slug}-qr.png`, data)
  }

  async function downloadSvg() {
    const svg = await qrSvgString(url, style)
    downloadString(`${slug}-qr.svg`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  }

  return (
    <div className="card-soft p-4">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex h-52 w-52 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white p-3">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={png} alt={`QR code for ${businessName}`} className="h-full w-full" />
          ) : (
            <QrCode className="h-10 w-10 text-stone-300" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="section-label">Scan destination</p>
            <p className="mt-1 truncate text-sm text-stone-600">{url}</p>
            <p className="mt-1 text-xs text-stone-400">Opens your marketplace profile.</p>
          </div>

          <div>
            <p className="section-label mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = style.dark === p.dark && style.light === p.light
                return (
                  <button
                    key={p.label}
                    onClick={() => setStyle({ dark: p.dark, light: p.light })}
                    className={
                      'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ' +
                      (active ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300')
                    }
                  >
                    <span className="h-3 w-3 rounded-full border border-stone-200" style={{ background: p.dark }} />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadPng}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" /> Download PNG
            </button>
            <button
              onClick={downloadSvg}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              <Download className="h-4 w-4" /> Download SVG
            </button>
          </div>
          <p className="text-xs text-stone-400">PNG for screens, SVG for print (stays sharp at any size).</p>
        </div>
      </div>
    </div>
  )
}
