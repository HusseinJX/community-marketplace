'use client'

import { useEffect, useState } from 'react'
import { Plus, Sparkles, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'
import { VendorAgentChat } from './VendorAgentChat'

type Msg = { role: 'user' | 'assistant'; content: string }
type Convo = { id: string; title: string; updatedAt: number; messages: Msg[]; cid: string | null }

// ChatGPT-style console for the owner's own AI agent: a list of past
// conversations on the left/top, "New chat" to start one, each opening a thread
// with the SAME assistant customers talk to (VendorAgentChat → /api/chat/[id]).
//
// Conversations persist in localStorage per member — the owner's private test
// chats don't belong in the customer-DM store, and this needs no new backend.

const keyFor = (memberId: string) => `wl_assistant_convos_${memberId}`

function timeAgo(ms: number): string {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Math.random().toString(36).slice(2)}`
}

function titleFrom(messages: Msg[]): string {
  const first = messages.find((m) => m.role === 'user')?.content?.trim()
  if (!first) return 'New chat'
  return first.length > 40 ? `${first.slice(0, 40)}…` : first
}

function previewFrom(messages: Msg[]): string {
  const last = [...messages].reverse().find((m) => m.content.trim())
  return last?.content?.trim().slice(0, 80) || 'No messages yet'
}

export function AssistantConsole({
  memberId,
  memberName = 'your business',
  onChatOpenChange,
}: {
  memberId: string
  memberName?: string
  onChatOpenChange?: (open: boolean) => void
}) {
  const [convos, setConvos] = useState<Convo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Tell the parent when a chat thread is open vs the "All chats" list.
  useEffect(() => {
    onChatOpenChange?.(activeId != null)
  }, [activeId, onChatOpenChange])

  // Hydrate from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(memberId))
      const parsed: Convo[] = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) setConvos(parsed)
    } catch {
      /* corrupt/absent → empty */
    }
    setLoaded(true)
  }, [memberId])

  // Persist whenever the list changes (after the first hydrate).
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(keyFor(memberId), JSON.stringify(convos)) } catch { /* full/private */ }
  }, [convos, memberId, loaded])

  function startNew() {
    const c: Convo = { id: newId(), title: 'New chat', updatedAt: Date.now(), messages: [], cid: null }
    setConvos((list) => [c, ...list])
    setActiveId(c.id)
  }

  function persist(id: string, messages: Msg[], cid: string | null) {
    setConvos((list) => {
      const idx = list.findIndex((c) => c.id === id)
      if (idx < 0) return list
      // Nothing said yet → don't bump it to the top or rename.
      if (messages.length === 0) return list
      const updated: Convo = {
        ...list[idx],
        messages,
        cid,
        title: titleFrom(messages),
        updatedAt: Date.now(),
      }
      const rest = list.filter((c) => c.id !== id)
      return [updated, ...rest]
    })
  }

  const active = convos.find((c) => c.id === activeId) || null

  // ── Chat view ─────────────────────────────────────────────────────────────
  if (active) {
    return (
      // Fills the shell's full-screen box rather than measuring the viewport
      // itself — it can't see its own chrome, and `100dvh - 18rem` was a guess
      // that disagreed with the vendor assistant page's `- 14rem` for the very
      // same chat. The parent knows the height; this just takes what's left.
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-6 pt-6">
        <button
          onClick={() => setActiveId(null)}
          className="mb-4 shrink-0 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ChevronLeft className="h-4 w-4" /> All chats
        </button>
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-stone-200 bg-white">
          <div className="flex shrink-0 items-center gap-3 border-b border-stone-100 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">Your AI agent</p>
              <p className="truncate text-[11px] text-emerald-600">● Always on</p>
            </div>
          </div>
          <VendorAgentChat
            key={active.id}
            memberId={memberId}
            memberName={memberName}
            initialMessages={active.messages}
            initialConversationId={active.cid}
            onChange={(m, cid) => persist(active.id, m, cid)}
          />
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl">
      <button
        onClick={startNew}
        className="flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 transition hover:border-indigo-200"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
          <Plus className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">New chat</span>
            <span className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              AI
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone-500">
            Chat with the assistant your customers talk to — test it, ask it anything.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" />
      </button>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-stone-700">Your conversations</h2>
      {convos.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
            <MessageSquare className="h-5 w-5 text-stone-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-stone-700">No conversations yet</p>
          <p className="mt-1 max-w-xs text-sm text-stone-500">
            Start a new chat to talk with your AI agent. Your threads are saved here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-stone-900">{c.title}</span>
                  <span className="shrink-0 text-[11px] text-stone-400">{timeAgo(c.updatedAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-stone-500">{previewFrom(c.messages)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
