'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Pencil, ExternalLink, Users } from 'lucide-react'
import type { VendorEvent } from '@/lib/vendor-connect'

// The event card as the public sees it (mirrors /events/[id]) plus, for the
// host, inline edit. Shared by the real collab room and the demo. Editing goes
// through PATCH /api/events/[hostMemberId] — the resolveActor-gated path — never
// a new endpoint.
export function CollabEventTab({
  event,
  hostMemberId,
  canEdit,
  demo = false,
  onSaved,
}: {
  event: VendorEvent
  hostMemberId: string
  canEdit: boolean
  demo?: boolean
  onSaved?: (e: VendorEvent) => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: event.title ?? '',
    description: event.description ?? '',
    event_date: event.event_date ?? '',
    event_time: event.event_time ?? '',
    location: event.location ?? '',
  })

  const dateLabel = (() => {
    if (!form.event_date) return null
    const d = new Date(form.event_date + 'T00:00:00')
    if (isNaN(d.getTime())) return form.event_date
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  })()

  async function save() {
    setBusy(true)
    setError(null)
    if (demo) {
      // Local-only: reflect the edit without a network call.
      onSaved?.({ ...event, ...form })
      setEditing(false)
      setBusy(false)
      return
    }
    try {
      const res = await fetch(`/api/events/${hostMemberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id, ...form }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save.')
      } else {
        onSaved?.({ ...event, ...form })
        setEditing(false)
      }
    } catch {
      setError('Could not save.')
    }
    setBusy(false)
  }

  if (editing) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-xs font-medium text-stone-500">Edit the event — this is what the public sees.</p>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Event title"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What's happening?"
          rows={3}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={form.event_date}
            onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
            className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900"
          />
          <input
            type="time"
            value={form.event_time}
            onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))}
            className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900"
          />
        </div>
        <input
          value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          placeholder="Location"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={busy || !form.title.trim()}
            className="rounded-full bg-stone-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setError(null) }}
            className="rounded-full border border-stone-200 px-4 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Public-style event card */}
      <div className="overflow-hidden rounded-2xl border border-stone-200">
        {event.poster_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.poster_image_url} alt="" className="h-40 w-full object-cover" />
        )}
        <div className="space-y-2 p-4">
          <p className="text-lg font-semibold text-stone-900">{form.title || 'Untitled event'}</p>
          {(dateLabel || form.event_time) && (
            <p className="flex items-center gap-1.5 text-sm text-stone-600">
              <Calendar className="h-4 w-4 text-stone-400" />
              {dateLabel}{form.event_time ? ` · ${form.event_time}` : ''}
            </p>
          )}
          {form.location && (
            <p className="flex items-center gap-1.5 text-sm text-stone-600">
              <MapPin className="h-4 w-4 text-stone-400" /> {form.location}
            </p>
          )}
          {form.description && <p className="pt-1 text-sm text-stone-600">{form.description}</p>}
          {event.member_name && (
            <p className="flex items-center gap-1.5 pt-1 text-xs text-stone-400">
              <Users className="h-3.5 w-3.5" /> Hosted by {event.member_name}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3.5 py-1.5 text-[13px] font-medium text-stone-700 hover:bg-stone-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit event
          </button>
        )}
        {!demo && (
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View public page
          </Link>
        )}
      </div>
    </div>
  )
}
