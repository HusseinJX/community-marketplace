'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, ShoppingCart, Calendar, ArrowRight, Lock,
  MessageCircle, Heart, CreditCard, Info, MapPin, Tag, AtSign, Globe, ExternalLink,
  Pencil, Check, X, Radio,
} from 'lucide-react'
import { PlanSwitch, PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

export interface VendorAbout {
  bio?: string
  category?: string
  city?: string
  neighborhood?: string
  instagram?: string
  website?: string
}

function AboutSection({ about, memberId }: { about: VendorAbout | null; memberId: string | null }) {
  const [editing, setEditing] = useState(false)
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

      <div className="card-soft space-y-3 p-5">
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
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setErr('') }} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200">
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

// Free / Basic / Pro gate the dashboard sections (replaces the old commerce
// toggle). The switch shares state with the collab page via PLAN_KEY.

function LockedTile({ Icon, label, note = 'Locked' }: { Icon: typeof Package; label: string; note?: string }) {
  return (
    <div
      title={`Upgrade to ${note} to unlock`}
      className="card-soft flex cursor-not-allowed items-center justify-between p-5 opacity-60"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-stone-300" />
        <span className="text-sm font-semibold text-stone-400">{label}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-400">
        <Lock className="h-3.5 w-3.5" /> {note}
      </span>
    </div>
  )
}

function Tile({ href, Icon, label, desc }: { href: string; Icon: typeof Package; label: string; desc?: string }) {
  return (
    <Link href={href} className="card-soft card-hover flex items-center justify-between p-5">
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-indigo-500" />
        <span>
          <span className="block text-sm font-semibold text-stone-900">{label}</span>
          {desc && <span className="block text-xs text-stone-500">{desc}</span>}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-stone-400" />
    </Link>
  )
}

export function VendorHome({
  orderCount, plan, planLabel, about = null, memberId = null,
}: { orderCount: number; plan: string; planLabel: string; about?: VendorAbout | null; memberId?: string | null }) {
  const initial: Tier = plan === 'member' ? 'member' : plan === 'free' ? 'free' : 'pro'
  const [tier, setTier] = useState<Tier>(initial)

  useEffect(() => {
    const v = localStorage.getItem(PLAN_KEY)
    if (v === 'free' || v === 'member' || v === 'pro') setTier(v)
  }, [])

  function pick(t: Tier) {
    setTier(t)
    localStorage.setItem(PLAN_KEY, t)
  }

  // Every tier shows the SAME cards; lower tiers just see the gated ones disabled.
  const rank = tier === 'pro' ? 2 : tier === 'member' ? 1 : 0
  const needsPro = rank < 2   // commerce (Products / Orders)
  const needsBasic = rank < 1 // Agent
  // Events are self-hosted and available to EVERY tier (create/edit + RSVP, no
  // collaboration/lineup — that lives in the Collabs tab, gated separately).
  // Collabs + Resources are top-nav tabs (gated there), not dashboard buttons.

  const metrics = [
    { label: 'Products', value: '3', href: '/vendor/products', icon: Package, locked: needsPro, note: 'Pro' },
    { label: 'Orders', value: orderCount > 0 ? String(orderCount) : '—', href: '/vendor/orders', icon: ShoppingCart, locked: needsPro, note: 'Pro' },
    { label: 'Events', value: '—', href: '/vendor/events', icon: Calendar, locked: false, note: 'Basic' },
  ]

  return (
    <>
      {/* Plan switch — gates everything below (shared with the collab page) */}
      <PlanSwitch tier={tier} onPick={pick} caption="Preview each tier — gates the features below." />

      {/* About — the business bio + details (from the member profile) */}
      <AboutSection about={about} memberId={memberId} />

      {/* Quick access */}
      <div>
        <p className="section-label mb-3">Quick access</p>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((card) => {
            const Icon = card.icon
            if (card.locked) {
              return (
                <div
                  key={card.label}
                  title={`Upgrade to ${card.note} to unlock`}
                  className="card-soft flex cursor-not-allowed flex-col items-center gap-1 p-3 text-center opacity-60"
                >
                  <Icon className="h-5 w-5 text-stone-300" />
                  <span className="text-[11px] font-medium leading-tight text-stone-400">{card.label}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-stone-400">
                    <Lock className="h-3 w-3" /> {card.note}
                  </span>
                </div>
              )
            }
            return (
              <Link key={card.label} href={card.href} className="card-soft card-hover flex flex-col items-center gap-1 p-3 text-center">
                <Icon className="h-5 w-5 text-indigo-500" />
                <span className="text-[11px] font-medium leading-tight text-stone-500">{card.label}</span>
                <span className="text-base font-semibold text-stone-900">{card.value}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Manage */}
      <div className="grid gap-3 sm:grid-cols-2">
        {needsPro ? <LockedTile Icon={Package} label="My Products" note="Pro" /> : <Tile href="/vendor/products" Icon={Package} label="My Products" />}
        <Tile href="/vendor/events" Icon={Calendar} label="My Events" desc="Host events + collect RSVPs" />
        <Tile href="/share?vendor=1" Icon={Radio} label="Post / Go live" desc="Share an update or broadcast live" />
      </div>

      {/* Tools (QR moved to the title button; Collabs/Resources live in the top nav) */}
      <div>
        <p className="section-label mb-3">Tools</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {needsBasic
            ? <LockedTile Icon={MessageCircle} label="Your agent" note="Basic" />
            : <Tile href="/vendor/assistant" Icon={MessageCircle} label="Your agent" desc="Train your customer-service AI" />}
          <Tile href="/vendor/giving" Icon={Heart} label="Giving" desc="Log community contributions" />
          <Tile href="/vendor/billing" Icon={CreditCard} label="Plan & billing" desc={`Current plan: ${planLabel}`} />
        </div>
      </div>
    </>
  )
}
