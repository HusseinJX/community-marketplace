'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Check } from 'lucide-react'
import { ImageCaptureUploader } from '@/components/ImageCaptureUploader'
import { demoVendorEvents } from '@/lib/demo-catalog'
import { EventLocationPicker } from '@/components/events/EventLocationPicker'

interface VEvent {
  id: string
  title: string
  description: string | null
  event_date: string | null
  event_time: string | null
  location: string | null
  poster_image_url: string | null
  source: string
  active: boolean
}

export function EventsManager({
  memberId,
  memberName,
  isAdmin,
  adminDemo = false,
  businessLat = null,
  businessLng = null,
}: {
  memberId: string
  memberName: string
  isAdmin: boolean
  adminDemo?: boolean
  businessLat?: number | null
  businessLng?: number | null
}) {
  const [events, setEvents] = useState<VEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', event_date: '', event_time: '', location: '', description: '', capacity: '' })
  // Map pin for the new event — defaults to the business location, draggable.
  const businessPin: [number, number] | null =
    businessLat != null && businessLng != null ? [businessLat, businessLng] : null
  const [pin, setPin] = useState<[number, number] | null>(businessPin)

  const load = useCallback(async () => {
    // Admin demo has no real backend member — seed sample rows instead.
    if (adminDemo) {
      setEvents(demoVendorEvents())
      setLoading(false)
      return
    }
    const res = await fetch(`/api/events/${memberId}?include_drafts=1`)
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }, [memberId, adminDemo])

  useEffect(() => {
    load()
  }, [load])

  async function approve(id: string) {
    if (adminDemo) {
      setEvents((e) => e.map((x) => (x.id === id ? { ...x, active: true } : x)))
      return
    }
    await fetch(`/api/events/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: true }),
    })
    load()
  }

  async function remove(id: string) {
    if (adminDemo) {
      setEvents((e) => e.filter((x) => x.id !== id))
      return
    }
    await fetch(`/api/events/${memberId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setEvents((e) => e.filter((x) => x.id !== id))
  }

  function resetForm() {
    setForm({ title: '', event_date: '', event_time: '', location: '', description: '', capacity: '' })
    setPin(businessPin)
    setShowAdd(false)
  }

  async function addManual() {
    if (!form.title.trim()) return
    if (adminDemo) {
      setEvents((e) => [
        { id: `demo-vevent-${Date.now()}`, title: form.title, description: form.description || null, event_date: form.event_date || null, event_time: form.event_time || null, location: form.location || null, poster_image_url: null, source: 'manual', active: true },
        ...e,
      ])
      resetForm()
      return
    }
    await fetch(`/api/events/${memberId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberName,
        ...form,
        lat: pin ? pin[0] : undefined,
        lng: pin ? pin[1] : undefined,
        active: true,
        source: 'manual',
      }),
    })
    resetForm()
    load()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Events</h1>
          <p className="mt-1 text-sm text-stone-500">
            {memberName}
            {isAdmin && <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">admin</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800">
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>

      {showAdd && (
        <div className="card-soft space-y-3 p-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} placeholder="Date" className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
            <input value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} placeholder="Time" className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </div>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location name (e.g. Dolores Park)" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <div>
            <p className="mb-1.5 text-xs text-stone-500">
              Pin the venue on the map — drag or tap. Defaults to your business location.
            </p>
            <EventLocationPicker value={pin} onChange={setPin} />
          </div>
          <input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Capacity (optional — blank = unlimited RSVPs)" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <button onClick={addManual} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700">Save</button>
        </div>
      )}

      <ImageCaptureUploader memberId={memberId} memberName={memberName} mode="events" onSaved={load} />

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="section-label">Your events ({events.length})</p>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
            >
              <Plus className="h-3.5 w-3.5" /> Create
            </button>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-stone-400">No events yet. Tap Create to add one.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <EventRow
                  key={e.id}
                  e={e}
                  onPublish={!e.active ? () => approve(e.id) : undefined}
                  onDelete={() => remove(e.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function EventRow({ e, onPublish, onDelete }: { e: VEvent; onPublish?: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
      {/* Clicking the event opens its manager (Attendees + Updates). */}
      <Link href={`/vendor/events/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        {e.poster_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.poster_image_url} alt={e.title} className="h-16 w-12 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-12 rounded-lg bg-stone-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-900 hover:text-indigo-700">{e.title}</p>
          <p className="truncate text-xs text-stone-500">
            {[e.event_date, e.event_time, e.location].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>
      {!e.active && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Draft</span>}
      {e.source.startsWith('ai_') && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">AI</span>}
      {onPublish && (
        <button onClick={onPublish} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
          <Check className="h-3.5 w-3.5" /> Publish
        </button>
      )}
      <button onClick={onDelete} className="text-stone-400 hover:text-red-600" aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
