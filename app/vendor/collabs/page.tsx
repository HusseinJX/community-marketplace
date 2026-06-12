'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Users, Send, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react'

interface Participant {
  memberId: string
  memberName: string | null
  memberType: string | null
  role: string | null
}

interface Room {
  id: string
  collabId: string
  title: string | null
  type: string | null
  status: 'open' | 'closed'
  outcome: 'proceeding' | 'skipped' | null
  participants: Participant[]
  proceedVotes: Record<string, 'proceed' | 'skip'>
}

interface Message {
  id: string
  senderId: string
  senderName: string | null
  text: string
  system?: boolean
  createdAt?: { _seconds: number } | string | null
}

function msgTime(m: Message): string {
  const c = m.createdAt
  const ms = typeof c === 'string' ? Date.parse(c) : c && '_seconds' in c ? c._seconds * 1000 : 0
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function VendorCollabsPage() {
  const [memberId, setMemberId] = useState<string>('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadRooms = useCallback(() => {
    fetch('/api/vendor/collabs')
      .then(r => r.json())
      .then(d => {
        setMemberId(d.memberId ?? '')
        setRooms(d.rooms ?? [])
        setActiveId(prev => prev ?? (d.rooms?.[0]?.id ?? null))
      })
      .finally(() => setLoading(false))
  }, [])

  const loadMessages = useCallback((roomId: string) => {
    fetch('/api/vendor/collabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'messages', roomId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.room) setRoom(d.room)
        if (d.messages) setMessages(d.messages)
      })
  }, [])

  useEffect(() => { loadRooms() }, [loadRooms])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    const t = setInterval(() => loadMessages(activeId), 5000)
    return () => clearInterval(t)
  }, [activeId, loadMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function send() {
    const text = draft.trim()
    if (!text || !activeId) return
    setSending(true)
    setDraft('')
    try {
      await fetch('/api/vendor/collabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', roomId: activeId, text }),
      })
      loadMessages(activeId)
    } finally {
      setSending(false)
    }
  }

  async function vote(v: 'proceed' | 'skip') {
    if (!activeId) return
    await fetch('/api/vendor/collabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', roomId: activeId, vote: v }),
    })
    loadRooms()
    loadMessages(activeId)
  }

  if (loading) return <p className="text-sm text-stone-500">Loading your collaborations…</p>

  if (!rooms.length) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-stone-300" />
        <h1 className="mt-3 text-lg font-semibold text-stone-900">No collaborations yet</h1>
        <p className="mt-1 text-sm text-stone-500">
          When you say yes to a collaboration we line up for you, a shared room opens here to plan it with the other members.
        </p>
      </div>
    )
  }

  const myVote = room ? room.proceedVotes?.[memberId] : undefined

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-stone-900">Collaborations</h1>
      <p className="mb-6 text-sm text-stone-500">Plan and finalize the collaborations you opted into.</p>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* Rooms list */}
        <div className="space-y-2">
          {rooms.map(r => (
            <button
              key={r.id}
              onClick={() => { setActiveId(r.id); setRoom(r); setMessages([]) }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                r.id === activeId ? 'border-rose-300 bg-rose-50' : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="text-sm font-medium text-stone-900">{r.title || 'Collaboration'}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                <Users className="h-3 w-3" /> {r.participants.length}
                {r.status === 'closed' && (
                  <span className={`ml-1 rounded px-1.5 py-0.5 ${r.outcome === 'proceeding' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {r.outcome === 'proceeding' ? 'going ahead' : 'skipped'}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Chat panel */}
        <div className="flex h-[32rem] flex-col rounded-xl border border-stone-200 bg-white">
          {room && (
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="text-sm font-semibold text-stone-900">{room.title || 'Collaboration'}</div>
              <div className="text-xs text-stone-500">
                {room.participants.map(p => p.memberName || p.memberType || 'member').join(' · ')}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map(m => {
              if (m.system) {
                return (
                  <div key={m.id} className="text-center">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">{m.text}</span>
                  </div>
                )
              }
              const mine = m.senderId === memberId
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && <span className="mb-0.5 text-xs text-stone-500">{m.senderName || 'Member'}</span>}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-900'}`}>
                    {m.text}
                  </div>
                  <span className="mt-0.5 text-[10px] text-stone-400">{msgTime(m)}</span>
                </div>
              )
            })}
          </div>

          {/* Vote bar */}
          {room && room.status === 'open' && (
            <div className="flex items-center gap-2 border-t border-stone-200 px-4 py-2">
              <span className="text-xs text-stone-500">Ready to decide?</span>
              <button
                onClick={() => vote('proceed')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${myVote === 'proceed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              >
                <ThumbsUp className="h-3 w-3" /> Let&apos;s do it
              </button>
              <button
                onClick={() => vote('skip')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${myVote === 'skip' ? 'bg-stone-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                <ThumbsDown className="h-3 w-3" /> Not this time
              </button>
            </div>
          )}

          {/* Composer */}
          {room && room.status === 'open' ? (
            <div className="flex items-center gap-2 border-t border-stone-200 px-3 py-3">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder="Message the group…"
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none"
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            room && <div className="border-t border-stone-200 px-4 py-3 text-center text-xs text-stone-500">This room is closed.</div>
          )}
        </div>
      </div>
    </div>
  )
}
