'use client'

import { useState } from 'react'
import { LayoutDashboard, ArrowRight } from 'lucide-react'
import { DEMO_TYPES, writeDemoCookies, type DemoMemberType } from '@/lib/demo-admin'
import { getCategories } from '@/lib/taxonomy'

// Admin demo launcher: enter the business portal as any member type, to test
// and refine each type's admin UI quickly. (Shopper has its own hero button.)
export default function DemoLauncher() {
  const [type, setType] = useState<DemoMemberType>('vendor')
  const [subtype, setSubtype] = useState('')

  const categories = getCategories(type)

  function openAdmin() {
    writeDemoCookies(type, subtype)
    window.location.href = '/vendor'
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-7 w-7 text-violet-500" />
        <h1 className="text-xl font-semibold text-stone-900">Admin demo</h1>
      </div>
      <p className="mt-2 text-stone-500">Preview the business portal as any member type.</p>

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-4">
        <label className="block text-xs font-medium text-stone-600">Member type</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DEMO_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setType(t.key)
                setSubtype('')
              }}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition ' +
                (type === t.key
                  ? 'bg-violet-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <>
            <label className="mt-4 block text-xs font-medium text-stone-600">Category (optional)</label>
            <select
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-violet-400 focus:outline-none"
            >
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          onClick={openAdmin}
          className="mt-5 inline-flex w-full items-center justify-center gap-1 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Open admin demo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
