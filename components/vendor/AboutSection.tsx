'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Package, Info, MapPin, Tag, AtSign, Globe, ExternalLink, Pencil, Check, X,
} from 'lucide-react'

export interface VendorAbout {
  bio?: string
  category?: string
  city?: string
  neighborhood?: string
  instagram?: string
  website?: string
}

// The business bio + details (from the member profile). Rendered on its own
// edit page (/vendor/about). `startEditing` opens straight into the form.
export function AboutSection({
  about, memberId, startEditing = false,
}: { about: VendorAbout | null; memberId: string | null; startEditing?: boolean }) {
  const [editing, setEditing] = useState(startEditing)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState<VendorAbout>({
    bio: about?.bio ?? '', category: about?.category ?? '', city: about?.city ?? '',
    neighborhood: about?.neighborhood ?? '', instagram: about?.instagram ?? '', website: about?.website ?? '',
  })
  const [saved, setSaved] = useState<VendorAbout>(form)

  const up = (k: keyof VendorAbout, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!memberId) return
    setSaving(true)
    setErr('')
    try {
      const res = await fetch(`/api/members/${memberId}/about`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed to save')
      setSaved(form)
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const cur = saved
  const place = [cur.neighborhood, cur.city].filter(Boolean).join(', ')
  const hasDetails = cur.category || place || cur.instagram || cur.website

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="section-label">About</p>
        {memberId && !editing && (
          <button
            onClick={() => { setForm(saved); setErr(''); setEditing(true) }}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
        {memberId && (
          <Link
            href={`/members/${memberId}`}
            className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-200"
          >
            View profile <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="card-soft space-y-3 p-4">
        {editing ? (
          <>
            <textarea
              value={form.bio}
              onChange={(e) => up('bio', e.target.value)}
              rows={3}
              placeholder="Tell shoppers who you are and what you do…"
              className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <AboutInput Icon={Tag} value={form.category} onChange={(v) => up('category', v)} placeholder="Category (e.g. Food & Drink)" />
              <AboutInput Icon={MapPin} value={form.neighborhood} onChange={(v) => up('neighborhood', v)} placeholder="Neighborhood" />
              <AboutInput Icon={MapPin} value={form.city} onChange={(v) => up('city', v)} placeholder="City" />
              <AboutInput Icon={AtSign} value={form.instagram} onChange={(v) => up('instagram', v)} placeholder="Instagram handle" />
              <AboutInput Icon={Globe} value={form.website} onChange={(v) => up('website', v)} placeholder="Website URL" />
            </div>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setErr('') }} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3.5 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-200">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {cur.bio ? (
              <p className="flex gap-2 text-sm text-stone-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span>{cur.bio}</span>
              </p>
            ) : (
              <p className="flex gap-2 text-sm text-stone-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" />
                <span>No bio yet — tap <strong>Edit</strong> to add one so shoppers know who you are.</span>
              </p>
            )}
            {hasDetails && (
              <div className="flex flex-wrap gap-2 pt-1">
                {cur.category && <Chip Icon={Tag} label={cur.category} />}
                {place && <Chip Icon={MapPin} label={place} />}
                {cur.instagram && <Chip Icon={AtSign} label={`@${cur.instagram.replace(/^@/, '')}`} />}
                {cur.website && <Chip Icon={Globe} label={cur.website.replace(/^https?:\/\//, '')} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AboutInput({ Icon, value, onChange, placeholder }: { Icon: typeof Package; value?: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-stone-200 px-3">
      <Icon className="h-4 w-4 shrink-0 text-stone-400" />
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent py-2 text-sm focus:outline-none" />
    </label>
  )
}

function Chip({ Icon, label }: { Icon: typeof Package; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
      <Icon className="h-3.5 w-3.5 text-stone-400" /> {label}
    </span>
  )
}
