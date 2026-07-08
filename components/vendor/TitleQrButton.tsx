'use client'

import { useState } from 'react'
import { QrCode, X } from 'lucide-react'
import { BasicQr } from '@/components/qr/BasicQr'

// Small QR button that sits next to the dashboard title. Opens a modal showing
// the basic (non-AI) QR that links to the business's public profile.
export function TitleQrButton({ url, businessName }: { url: string; businessName: string }) {
  const [open, setOpen] = useState(false)
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{businessName} · QR code</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full bg-white/90 p-1.5 text-stone-600 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <BasicQr url={url} businessName={businessName} />
          </div>
        </div>
      )}
    </>
  )
}
