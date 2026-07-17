'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Trash2, Plus, Inbox, Save, FileUp, UserCircle, MessageCircle } from 'lucide-react'
import { AgentTuner } from '@/components/vendor/AgentTuner'
import { AskAssistant } from '@/components/AskAssistant'

interface Knowledge {
  id: string
  content: string
}
interface Lead {
  id: string
  name: string | null
  contact: string | null
  message: string | null
  created_at: string
}

export default function VendorAssistantPage() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [persona, setPersona] = useState('')
  const [knowledge, setKnowledge] = useState<Knowledge[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [newKnowledge, setNewKnowledge] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('your business')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const d = await fetch('/api/vendor/assistant').then((r) => r.json())
    if (!d.error) {
      setMemberId(d.memberId ?? null)
      setMemberName(d.memberName ?? 'your business')
      setEnabled(d.enabled)
      setPersona(d.persona ?? '')
      setKnowledge(d.knowledge ?? [])
      setLeads(d.leads ?? [])
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function saveConfig() {
    setSavingConfig(true)
    await fetch('/api/vendor/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'config', enabled, persona }),
    })
    setSavingConfig(false)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2000)
  }

  async function addKnowledge() {
    const content = newKnowledge.trim()
    if (!content) return
    await fetch('/api/vendor/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_knowledge', content }),
    })
    setNewKnowledge('')
    load()
  }

  async function uploadPdf(file: File) {
    if (!file) return
    if (file.type && file.type !== 'application/pdf') {
      setUploadMsg('Only PDF files')
      return
    }
    setUploading(true)
    setUploadMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('filename', file.name)
      const res = await fetch('/api/vendor/assistant/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Upload failed')
      setUploadMsg(`Added “${file.name}”${d.truncated ? ' (trimmed to fit)' : ''}`)
      load()
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function removeKnowledge(id: string) {
    await fetch('/api/vendor/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_knowledge', id }),
    })
    setKnowledge((prev) => prev.filter((k) => k.id !== id))
  }

  if (loading) return <p className="text-sm text-stone-500">Loading…</p>

  return (
    // pt-2 so the title clears the back bar / top nav instead of sitting right
    // under it.
    <div className="space-y-10 pt-2">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-semibold text-stone-900">Your agent</h1>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Your storefront has an AI agent that answers customer questions using your products,
          hours, events, and the notes you add below.
        </p>

        {/* View the public profile, or try the agent exactly as a customer would
            (same chat the profile's "Inquire" button opens). */}
        <div className="mt-3 flex flex-wrap gap-2">
          {memberId && (
            <Link
              href={`/members/${memberId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-stone-700 transition hover:bg-stone-50"
            >
              <UserCircle className="h-4 w-4" /> View profile
            </Link>
          )}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-assistant'))}
            disabled={!memberId}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" /> Test agent
          </button>
        </div>
      </div>

      {/* The same chat customers get on the profile. Mounted here so "Test agent"
          opens it; it listens for the open-assistant event. */}
      {memberId && <AskAssistant memberId={memberId} memberName={memberName} />}

      {/* Conversational tuner — talk or type to refine the agent. Its changes
          land in the config + notes below, so keep them in sync. */}
      <AgentTuner
        onUpdated={(cfg) => {
          setEnabled(cfg.enabled)
          setPersona(cfg.persona)
          setKnowledge(cfg.knowledge)
        }}
      />

      {/* Config */}
      <section className="card-soft space-y-4 p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          <span className="text-sm font-medium text-stone-800">
            Assistant enabled on my public profile
          </span>
        </label>

        <div>
          <label className="section-label">Tone & style (optional)</label>
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={3}
            placeholder="e.g. Friendly and casual. Always mention our weekend specials. Sign off with 'See you soon!'"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
          />
        </div>

        <button
          onClick={saveConfig}
          disabled={savingConfig}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {savingConfig ? 'Saving…' : savedAt ? 'Saved' : 'Save settings'}
        </button>
      </section>

      {/* Knowledge base */}
      <section>
        <p className="section-label mb-3">Custom answers & FAQs</p>
        <p className="mb-4 text-sm text-stone-500">
          Add anything the assistant should know that isn&apos;t already on your profile — parking,
          return policy, catering, allergens, etc.
        </p>
        <div className="space-y-2">
          {knowledge.map((k) => (
            <div key={k.id} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3">
              <p className="flex-1 text-sm text-stone-700">{k.content}</p>
              <button
                onClick={() => removeKnowledge(k.id)}
                className="text-stone-400 hover:text-red-600"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {knowledge.length === 0 && (
            <p className="text-sm text-stone-400">No custom answers yet.</p>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newKnowledge}
            onChange={(e) => setNewKnowledge(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKnowledge()}
            placeholder="Add a fact or FAQ…"
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
          />
          <button
            onClick={addKnowledge}
            disabled={!newKnowledge.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {/* Drop a PDF — menu, policy doc, brochure — and we'll read it in. */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) uploadPdf(f)
          }}
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-stone-200 bg-stone-50 hover:border-stone-300'
          }`}
        >
          <FileUp className="h-5 w-5 text-stone-400" />
          <p className="text-sm font-medium text-stone-700">
            {uploading ? 'Reading PDF…' : 'Drop a PDF here, or click to upload'}
          </p>
          <p className="text-xs text-stone-400">Menu, policies, brochure, price list — we extract the text.</p>
          {uploadMsg && <p className="mt-1 text-xs text-indigo-600">{uploadMsg}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadPdf(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      {/* Leads */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-stone-500" />
          <p className="section-label">Captured leads</p>
        </div>
        {leads.length === 0 ? (
          <p className="text-sm text-stone-400">
            When the assistant can&apos;t answer something, it collects the customer&apos;s contact here.
          </p>
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <div key={l.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-900">{l.name || 'Customer'}</span>
                  <span className="text-xs text-stone-400">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                </div>
                {l.contact && <div className="mt-0.5 text-sm text-indigo-700">{l.contact}</div>}
                {l.message && <p className="mt-1 text-sm text-stone-600">{l.message}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
