'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'

type Msg = { role: 'user' | 'assistant'; content: string }

// The owner's private line to their own business AI agent — the same assistant
// customers reach via the profile's "Inquire" button. Lets the owner test it,
// see how it answers, and ask it about their own business. Streams from
// /api/chat/[memberId] (heartbeat-free token stream).
export function VendorAgentChat({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const conversationId = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(input: string) {
    const text = input.trim()
    if (!text || busy) return
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setDraft('')
    setBusy(true)
    try {
      const res = await fetch(`/api/chat/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, conversationId: conversationId.current }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => 'Request failed'))
      const cid = res.headers.get('X-Conversation-Id')
      if (cid) conversationId.current = cid
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: acc }
          return copy
        })
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: "Sorry — I couldn't reach the agent. Please try again.",
        }
        return copy
      })
    } finally {
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
              <Sparkles className="h-7 w-7" />
            </span>
            <h2 className="mt-3 text-base font-semibold text-stone-900">Your AI agent</h2>
            <p className="mt-1 max-w-xs text-sm text-stone-500">
              This is the same assistant your customers talk to for {memberName}. Ask it anything —
              test its answers, check what it knows, or preview a customer question.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ' +
                (m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-800')
              }
            >
              {m.content || (busy ? '…' : '')}
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
        className="flex shrink-0 items-center gap-2 border-t border-stone-100 bg-white px-3 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message your agent…"
          className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
