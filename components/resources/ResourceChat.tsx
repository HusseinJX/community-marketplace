'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { getResource } from '@/lib/resources'
import { ResourceCard } from './ResourceCard'

type Msg = { role: 'user' | 'assistant'; content: string }

// The server streams plain text with inline ` RESOURCES:[...] ` markers. Pull
// the ids out for inline cards and strip the markers from the visible text.
function parse(raw: string): { text: string; ids: string[] } {
  const re = / RESOURCES:(\[[^\]]*\]) /g
  const ids: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    try {
      const arr = JSON.parse(m[1])
      if (Array.isArray(arr)) ids.push(...arr)
    } catch {
      /* partial marker mid-stream — ignore until complete */
    }
  }
  return { text: raw.replace(re, ' ').trim(), ids: Array.from(new Set(ids)) }
}

const STARTERS = [
  'What resources fit my business?',
  'How can I lower my energy bills?',
  'Help me get certified green',
]

export function ResourceChat({ businessName }: { businessName: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
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
      const res = await fetch('/api/vendor/resources/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => 'Request failed'))

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const chunks: string[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(decoder.decode(value, { stream: true }))
        const acc = chunks.join('')
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
          content: "Sorry — I couldn't reach the guide. Please try again.",
        }
        return copy
      })
    } finally {
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  return (
    <div className="card-soft flex h-[min(40rem,75vh)] flex-col overflow-hidden">
      <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
        <Sparkles className="h-4 w-4" />
        <div className="text-sm font-semibold leading-tight">
          Resource guide
          <div className="text-[11px] font-normal text-indigo-100">Ask what fits {businessName}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              Tell me about a need — energy, legal, permits, accessibility, funding — and I&apos;ll point
              you to resources that fit.
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200 hover:ring-indigo-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-indigo-600 px-3.5 py-2 text-sm text-white">
                  {m.content}
                </div>
              </div>
            )
          }
          const { text, ids } = parse(m.content)
          const cards = ids.map(getResource).filter(Boolean)
          return (
            <div key={i} className="space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-stone-100 px-3.5 py-2 text-sm text-stone-800">
                  {text || (busy ? '…' : '')}
                </div>
              </div>
              {cards.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {cards.map((r) => (
                    <ResourceCard key={r!.id} resource={r!} compact />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
        className="flex items-center gap-2 border-t border-stone-100 px-3 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about resources…"
          className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
