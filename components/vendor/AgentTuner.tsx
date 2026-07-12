'use client'

import { useEffect, useRef, useState } from 'react'
import { Wand2, Send, Mic, X, Check } from 'lucide-react'
import { VoiceCall } from '@/components/VoiceCall'

type Msg = { role: 'user' | 'assistant'; content: string }

interface TunerConfig {
  enabled: boolean
  persona: string
  knowledge: { id: string; content: string }[]
}

// Conversational agent tuner: talk (type or voice) and it refines the
// customer-service agent's tone + notes. Chat applies live via a tool loop;
// voice runs a Realtime conversation and applies the agreed changes on hang-up.
// Calls onUpdated so the parent settings page reflects the new config.
export function AgentTuner({ onUpdated }: { onUpdated: (config: TunerConfig) => void }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<Msg[]>([])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, applying])

  async function send(input: string) {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setDraft('')
    setBusy(true)
    try {
      const d = await fetch('/api/vendor/assistant/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      }).then((r) => r.json())
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: d.reply || "Okay — tell me what you'd like to change." },
      ])
      if (d.config) onUpdated(d.config)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry — I couldn't update the agent just now. Try again?" },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function applyVoiceTranscript() {
    const t = transcriptRef.current
    setVoiceOpen(false)
    if (t.length < 2) return
    setApplying(true)
    try {
      const d = await fetch('/api/vendor/assistant/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: t, fromVoice: true }),
      }).then((r) => r.json())
      if (d.config) onUpdated(d.config)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `🎙️ From our call: ${d.reply || 'updated your agent.'}` },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I couldn't apply the changes from the call. Try again?" },
      ])
    } finally {
      setApplying(false)
      transcriptRef.current = []
    }
  }

  const STARTERS = ['Make it less aggressive', 'Sound warmer and more casual', 'Always mention our weekend specials']

  return (
    <section className="card-soft overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-stone-900">Tune your agent</p>
            <p className="text-[11px] text-stone-500">Talk or type — it rewrites your agent as you go.</p>
          </div>
        </div>
        <button
          onClick={() => { transcriptRef.current = []; setVoiceOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          <Mic className="h-3.5 w-3.5" /> Talk to tune
        </button>
      </div>

      <div ref={scrollRef} className="max-h-80 min-h-[7rem] space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !applying && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              Tell me how your agent should behave and I&apos;ll fine-tune it — its tone, and what it should
              always (or never) say. Try:
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
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ' +
                (m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-800')
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {(busy || applying) && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-stone-100 px-3.5 py-2 text-sm text-stone-500">
              {applying ? 'Applying changes from your call…' : '…'}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(draft) }}
        className="flex items-center gap-2 border-t border-stone-100 px-4 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Make it less aggressive…"
          className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-3.5 py-2 text-[13px] text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
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

      {/* Voice tuning — Realtime conversation, applied on hang-up. */}
      {voiceOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="relative flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-auto sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-indigo-600" />
                <p className="text-sm font-semibold text-stone-900">Tune your agent by voice</p>
              </div>
              <button
                onClick={applyVoiceTranscript}
                aria-label="End & apply"
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <VoiceCall
              memberName="Your agent"
              tokenUrl="/api/vendor/assistant/voice"
              onTranscript={(m) => transcriptRef.current.push(m)}
              onClose={applyVoiceTranscript}
            />
            <p className="flex items-center justify-center gap-1.5 border-t border-stone-100 px-4 py-2 text-center text-[11px] text-stone-400">
              <Check className="h-3 w-3" /> Changes you agree to are applied when you end the call.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
