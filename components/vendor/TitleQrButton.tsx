'use client'

import { useEffect, useState } from 'react'
import { QrCode } from 'lucide-react'
import { qrPngDataUrl } from '@/lib/qr'

// Small QR button that sits next to the dashboard title. Opens the code and
// nothing else — it's for holding the phone up to a customer. Colours and
// downloads live on /vendor/qr. Tap anywhere (or Escape) to close.
export function TitleQrButton({ url, businessName }: { url: string; businessName: string }) {
  const [open, setOpen] = useState(false)
  const [png, setPng] = useState('')

  useEffect(() => {
    if (!open) return
    let live = true
    qrPngDataUrl(url, { dark: '#0c0a09', light: '#ffffff', size: 768 })
      .then((d) => live && setPng(d))
      .catch(() => live && setPng(''))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      live = false
      window.removeEventListener('keydown', onKey)
    }
  }, [open, url])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Show your QR code"
        aria-label="Show your QR code"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-indigo-300 hover:text-indigo-600"
      >
        <QrCode className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${businessName} QR code`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpen(false)}
        >
          <div className="aspect-square w-full max-w-sm rounded-2xl bg-white p-5">
            {png && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={png} alt={`QR code for ${businessName}`} className="h-full w-full" />
            )}
          </div>
        </div>
      )}
    </>
  )
}
