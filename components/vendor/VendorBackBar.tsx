'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

// Top-level nav-tab destinations — no back button on these (you switch tabs
// from the navbar). Shown only on deeper pages (organize, giving, products…).
const TAB_PATHS = new Set(['/vendor', '/vendor/live', '/vendor/network', '/vendor/resources', '/vendor/qr'])

// "Go back" button shown below the admin navbar on deeper pages — returns to the
// previous screen instead of all the way Home.
export function VendorBackBar() {
  const pathname = usePathname()
  const router = useRouter()
  if (TAB_PATHS.has(pathname)) return null
  return (
    <button
      onClick={() => router.back()}
      className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-900 active:scale-95"
    >
      <ChevronLeft className="h-4 w-4" /> Go back
    </button>
  )
}
