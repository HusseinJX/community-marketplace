'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, ChevronRight, ChevronLeft, MessageSquare, User } from 'lucide-react'

interface Thread {
  id: string
  createdAt: string
  lastAt: string
  count: number
  preview: string
  customerName: string | null
  customerContact: string | null
}
interface TranscriptMsg {
  role: string
  content: string
  created_at: string
}

function timeAgo(iso: string): string {
  const d = Date.parse(iso)
  if (!d) return ''
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function CustomerInbox() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Thread | null>(null)
  const [transcript, setTranscript] = useState<TranscriptMsg[]>([])
  const [loadingTx, setLoadingTx] = useState(false)

  useEffect(() => {
    fetch('/api/vendor/messages')
      .then((r) => r.json())
      .then((d) => setThreads(Array.isArray(d.threads) ? d.threads : []))
      .catch(() => setThreads([]))
      .finally(() => setLoading(false))
  }, [])

  function openThread(t: Thread) {
    setActive(t)
    setLoadingTx(true)
    setTranscript([])
    fetch(`/api/vendor/messages/${t.id}`)
      .then((r) => r.json())
      .then((d) => setTranscript(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => setTranscript([]))
      .finally(() => setLoadingTx(false))
  }

  // Transcript view — one customer conversation.
  if (active) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <button
          onClick={() => setActive(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ChevronLeft className="h-4 w-4" /> Inbox
        </button>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">
                {active.customerName || 'Customer'}
              </p>
              <p className="truncate text-[11px] text-stone-400">
                {active.customerContact || `${active.count} messages`} · {timeAgo(active.lastAt)}
              </p>
            </div>
          </div>
          <div className="space-y-3 px-4 py-5">
            {loadingTx && <p className="text-center text-sm text-stone-400">Loading…</p>}
            {!loadingTx &&
              transcript.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ' +
                      (m.role === 'user'
                        ? 'bg-stone-100 text-stone-800'
                        : 'bg-indigo-600 text-white')
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
          </div>
        </div>
        <p className="mt-3 px-1 text-center text-xs text-stone-400">
          Replies were handled by your AI agent. Left = customer, right = your agent.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* The owner's private line to their own business agent. */}
      <Link
        href="/vendor/messages/assistant"
        className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 transition hover:border-indigo-200"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
          <Sparkles className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">Your AI agent</span>
            <span className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              AI
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone-500">
            Chat with the assistant your customers talk to — test it, ask it anything.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" />
      </Link>

      {/* Customer DMs — conversations customers had with the business agent. */}
      <h2 className="mb-2 mt-8 text-sm font-semibold text-stone-700">From customers</h2>
      {loading ? (
        <p className="py-8 text-center text-sm text-stone-400">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
            <MessageSquare className="h-5 w-5 text-stone-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-stone-700">No customer messages yet</p>
          <p className="mt-1 max-w-xs text-sm text-stone-500">
            When customers message your business through your profile, their conversations show up
            here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(t)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                <User className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-stone-900">
                    {t.customerName || 'Customer'}
                  </span>
                  <span className="shrink-0 text-[11px] text-stone-400">{timeAgo(t.lastAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-stone-500">{t.preview}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
