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
        className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-indigo-300 hover:text-indigo-600"
      >
        <QrCode className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${businessName} QR code`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          {/* Sized by the SMALLER of the viewport's width and height (minus a
              1.5rem margin and the notch/home-bar insets), so the square fits
              a phone in landscape too — sizing by width alone overflowed any
              screen shorter than it is wide. The image follows the box's
              width, never a percentage height. */}
          <div
            className="aspect-square shrink-0 rounded-2xl bg-white p-4 sm:p-5"
            style={{
              width:
                'min(24rem, calc(100vw - 3rem - env(safe-area-inset-left) - env(safe-area-inset-right)), calc(100dvh - 3rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)))',
            }}
          >
            {png && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={png} alt={`QR code for ${businessName}`} className="block h-auto w-full" />
            )}
          </div>
        </div>
      )}
    </>
  )
}
