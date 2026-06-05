'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { ImageCaptureUploader } from '@/components/ImageCaptureUploader'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  active: boolean
  source?: string
}

export function ProductsManager({
  memberId,
  memberName,
  isAdmin,
}: {
  memberId: string
  memberName: string
  isAdmin: boolean
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/products/${memberId}?include_drafts=1`)
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id: string, fields: Partial<Product>) {
    await fetch(`/api/products/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/products/${memberId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setProducts((p) => p.filter((x) => x.id !== id))
  }

  async function addManual() {
    if (!form.name.trim()) return
    await fetch(`/api/products/${memberId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberName,
        name: form.name,
        description: form.description || null,
        price: Math.round(parseFloat(form.price || '0') * 100),
        active: true,
        source: 'manual',
      }),
    })
    setForm({ name: '', description: '', price: '' })
    setShowAdd(false)
    load()
  }

  const drafts = products.filter((p) => !p.active)
  const live = products.filter((p) => p.active)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Products</h1>
          <p className="mt-1 text-sm text-stone-500">
            {memberName}
            {isAdmin && <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">admin</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {showAdd && (
        <div className="card-soft space-y-3 p-5">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-500">$</span>
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="0.00" className="w-32 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </div>
          <button onClick={addManual} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
        </div>
      )}

      <ImageCaptureUploader memberId={memberId} memberName={memberName} mode="products" onSaved={load} />

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          {drafts.length > 0 && (
            <section>
              <p className="section-label mb-3">Pending approval ({drafts.length})</p>
              <div className="space-y-2">
                {drafts.map((p) => (
                  <ProductRow key={p.id} p={p} onApprove={() => patch(p.id, { active: true })} onDelete={() => remove(p.id)} />
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="section-label mb-3">Live ({live.length})</p>
            {live.length === 0 ? (
              <p className="text-sm text-stone-400">No live products yet.</p>
            ) : (
              <div className="space-y-2">
                {live.map((p) => (
                  <ProductRow key={p.id} p={p} onDelete={() => remove(p.id)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ProductRow({ p, onApprove, onDelete }: { p: Product; onApprove?: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-stone-100" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900">{p.name}</p>
        <p className="truncate text-xs text-stone-500">{p.description}</p>
      </div>
      <span className="text-sm font-semibold text-stone-900">${(p.price / 100).toFixed(2)}</span>
      {p.source && p.source.startsWith('ai_') && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">AI</span>}
      {onApprove && (
        <button onClick={onApprove} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
      )}
      <button onClick={onDelete} className="text-stone-400 hover:text-red-600" aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
