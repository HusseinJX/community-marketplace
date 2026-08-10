'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { ImageCaptureUploader } from '@/components/ImageCaptureUploader'
import { UpgradePrompt, upgradeFrom } from '@/components/billing/UpgradePrompt'
import { demoProducts } from '@/lib/demo-catalog'
import { KIND_DEFS, type ProductKind } from '@/lib/product-kind'

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
  adminDemo = false,
}: {
  memberId: string
  memberName: string
  isAdmin: boolean
  adminDemo?: boolean
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', kind: 'good' as ProductKind })
  const [upgrade, setUpgrade] = useState<'member' | 'pro' | null>(null)
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  async function uploadFile(f?: File) {
    if (!f) return
    setUploading(true)
    setFileError(null)
    setFile(null)
    try {
      const body = new FormData()
      body.append('file', f)
      body.append('memberId', memberId)
      const res = await fetch('/api/vendor/digital-file', { method: 'POST', body })
      const d = await res.json()
      if (!res.ok) setFileError(d.error ?? 'Upload failed.')
      else setFile({ path: d.path, name: d.name, size: d.size })
    } catch {
      setFileError('Upload failed.')
    }
    setUploading(false)
  }

  const load = useCallback(async () => {
    // Admin demo has no real backend member — seed sample rows instead.
    if (adminDemo) {
      setProducts(demoProducts())
      setLoading(false)
      return
    }
    const res = await fetch(`/api/products/${memberId}?include_drafts=1`)
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }, [memberId, adminDemo])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id: string, fields: Partial<Product>) {
    if (adminDemo) {
      setProducts((p) => p.map((x) => (x.id === id ? { ...x, ...fields } : x)))
      return
    }
    await fetch(`/api/products/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    load()
  }

  async function remove(id: string) {
    if (adminDemo) {
      setProducts((p) => p.filter((x) => x.id !== id))
      return
    }
    await fetch(`/api/products/${memberId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setProducts((p) => p.filter((x) => x.id !== id))
  }

  async function addManual() {
    if (!form.name.trim()) return
    // A digital product with no file is a promise nobody can keep — the buyer
    // pays and the delivery step finds nothing to send. Blocked here rather
    // than discovered at checkout.
    if (form.kind === 'digital' && !file) {
      setFileError('Add the file customers will download.')
      return
    }
    if (adminDemo) {
      setProducts((p) => [
        { id: `demo-prod-${Date.now()}`, name: form.name, description: form.description || null, price: Math.round(parseFloat(form.price || '0') * 100), currency: 'usd', image_url: null, active: true, source: 'manual', kind: form.kind },
        ...p,
      ])
      setForm({ name: '', description: '', price: '', kind: 'good' })
      setShowAdd(false)
      return
    }
    const res = await fetch(`/api/products/${memberId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberName,
        name: form.name,
        description: form.description || null,
        price: Math.round(parseFloat(form.price || '0') * 100),
        active: true,
        source: 'manual',
        kind: form.kind,
        digital_file_path: file?.path ?? null,
        digital_file_name: file?.name ?? null,
        digital_file_size: file?.size ?? null,
      }),
    })
    // Commerce is a Pro capability — surface an upgrade prompt on 402.
    const up = upgradeFrom(res.status, await res.json().catch(() => null))
    if (up) {
      setUpgrade(up.requires)
      return
    }
    setUpgrade(null)
    setForm({ name: '', description: '', price: '', kind: 'good' })
    setFile(null)
    setShowAdd(false)
    load()
  }

  const drafts = products.filter((p) => !p.active)
  const live = products.filter((p) => p.active)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Products</h1>
          <p className="mt-1 text-sm text-stone-500">
            {memberName}
            {isAdmin && <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">admin</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800">
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {upgrade && (
        <UpgradePrompt
          requires={upgrade}
          message="Selling & catalog tools are on the Pro plan. Upgrade to add products, connect your shop, and use AI capture."
        />
      )}

      {showAdd && (
        <div className="card-soft space-y-3 p-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-500">$</span>
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="0.00" className="w-32 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </div>
          {/* What kind of thing this is decides how it gets fulfilled — a
              service must never reach the buyer as "Pick up".

              Tickets are excluded: they're sold on the event, not the catalog. */}
          <div className="flex flex-wrap gap-1.5">
            {(['good', 'service', 'digital'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, kind: k })}
                className={
                  'rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ' +
                  (form.kind === k
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300')
                }
              >
                {KIND_DEFS[k].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">{KIND_DEFS[form.kind].blurb}</p>

          {form.kind === 'digital' && (
            <div className="rounded-lg bg-stone-50 p-3">
              <label className="block text-xs font-medium text-stone-600">
                The file customers get
              </label>
              <input
                type="file"
                onChange={(e) => uploadFile(e.target.files?.[0])}
                className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
              {uploading && <p className="mt-2 text-xs text-stone-500">Uploading…</p>}
              {file && !uploading && (
                <p className="mt-2 text-xs text-emerald-700">{file.name} ready</p>
              )}
              {fileError && <p className="mt-2 text-xs text-rose-600">{fileError}</p>}
              <p className="mt-2 text-xs text-stone-400">
                Stored privately. Buyers get their own link — it can&apos;t be shared by copying a URL.
              </p>
            </div>
          )}
          <button onClick={addManual} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700">Save</button>
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
