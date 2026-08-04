'use client'

import { useMemo, useState } from 'react'
import {
  MessageSquare, ListChecks, Sparkles, Send, Check, AlertTriangle, Lock,
  CalendarPlus, Plus, Crown, PartyPopper, Users, Calendar, Ticket,
} from 'lucide-react'
import type { CollaborationSummary } from '@/lib/collab-network'
import type { VendorEvent } from '@/lib/vendor-connect'
import { CollabEventTab } from '@/components/vendor/CollabEventTab'
import { EventAttendees } from '@/components/organize/EventAttendees'
import {
  PLAN_FIELDS, COLLAB_TYPES, PARTICIPANTS, SEED_CHAT, SEED_PLAN, SEED_TASKS,
  PULLED_FROM_CHAT, APPROVAL_RESETTING_FIELDS, coordinatorReport,
  type PlanState, type PlanFieldKey, type ChatMsg, type DemoTask, type CollabTypeKey,
} from '@/lib/demo-collab-plan'

// Fully-clickable DEMO of the collaboration room: Chat (discuss) + Plan (the
// agreed record), a canned AI coordinator that pulls chat → plan and flags gaps,
// per-participant approval with reset-on-change, and a gated Create Event. All
// local state — nothing persists, no API, no paid AI.

const nameFor = (id: string) => PARTICIPANTS.find((p) => p.id === id)?.name ?? id
const FILLED = (v: string) => v.trim().length > 0
const HAS_CONFLICT = (v: string) => v.includes('⚠')

export function CollabRoomDemo({
  collab,
  owned = true,
  leadName = 'You',
}: {
  collab: CollaborationSummary
  owned?: boolean
  leadName?: string
}) {
  const [tab, setTab] = useState<'chat' | 'plan' | 'people' | 'event' | 'attendees'>('chat')
  // Who's said "I'm in 👍". Accepting an invite only opened the room — this is
  // the actual commitment, and it's what the event lineup is built from.
  // The lead is in by their own doing; a joiner opts in.
  const [inSet, setInSet] = useState<Set<string>>(() => {
    const s = new Set(PARTICIPANTS.filter((p) => p.agreed).map((p) => p.id))
    if (owned) s.add('you')
    return s
  })
  const imIn = inSet.has('you')

  function toggleIn(id: string) {
    setInSet((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const [messages, setMessages] = useState<ChatMsg[]>(SEED_CHAT)
  const [draft, setDraft] = useState('')
  const [plan, setPlan] = useState<PlanState>(SEED_PLAN)
  const [typeKey, setTypeKey] = useState<CollabTypeKey | ''>('')
  const [pulled, setPulled] = useState(false)
  const [tasks, setTasks] = useState<DemoTask[]>(SEED_TASKS)
  const [approvals, setApprovals] = useState<Record<string, boolean>>({})
  const [resetNote, setResetNote] = useState(false)
  // If the collaboration already has an event (the fixture carries an eventId),
  // the room opens on the "published" state — otherwise the list said "Active ·
  // Event 9/8" while the room still showed "Planning" and hid the Event/Attendees
  // tabs. Once published it stays published for the session.
  const [published, setPublished] = useState(!!collab.eventId)

  const requiredApprovers = PARTICIPANTS.filter((p) => !p.pending)
  const approvedCount = requiredApprovers.filter((p) => approvals[p.id]).length
  const allApproved = approvedCount === requiredApprovers.length

  const report = useMemo(() => coordinatorReport(plan, typeKey), [plan, typeKey])
  const currentType = COLLAB_TYPES.find((t) => t.key === typeKey)
  const requiredSet = new Set(currentType?.required ?? [])
  const canCreate = report.complete && allApproved && !!typeKey

  const status = published ? 'Published' : report.complete && !!typeKey ? 'Awaiting Approval' : 'Planning'

  // Once "published", the plan becomes an event card — the same shape a real
  // collab event takes, so the demo's Event + Attendees tabs match production.
  const demoEvent = useMemo<VendorEvent>(
    () => ({
      id: 'demo-event',
      member_id: 'demo',
      member_name: leadName === 'You' ? 'Your collab' : leadName,
      title: collab.label,
      description: plan.goal || null,
      // Prefer the collaboration's real event details (the fixture / summary);
      // fall back to whatever the plan holds.
      event_date: collab.eventDate || plan.date || null,
      event_time: collab.eventTime || null,
      location: collab.eventLocation || plan.venue || null,
      city: null,
      neighborhood: null,
      source_id: null,
      external_uid: null,
      event_url: null,
      end_date: null,
      lat: null,
      lng: null,
      poster_image_url: null,
      capacity: null,
      source: 'collab',
      active: true,
      created_at: '2026-07-01T00:00:00.000Z',
    }),
    [plan, collab.label, leadName],
  )

  // Never render a tab that isn't available (Event/Attendees exist only once
  // published) — derived, not a setState-in-render.
  const activeTab = !published && (tab === 'event' || tab === 'attendees') ? 'chat' : tab

  // Clear approvals when an "important" field changes (spec: major changes reset).
  function resetApprovalsIfNeeded(key: PlanFieldKey) {
    if (APPROVAL_RESETTING_FIELDS.includes(key) && Object.values(approvals).some(Boolean)) {
      setApprovals({})
      setResetNote(true)
    }
  }

  function setField(key: PlanFieldKey, value: string) {
    setPlan((p) => ({ ...p, [key]: value }))
    resetApprovalsIfNeeded(key)
  }

  function pickType(key: CollabTypeKey) {
    setTypeKey(key)
    setPlan((p) => ({ ...p, type: COLLAB_TYPES.find((t) => t.key === key)?.label ?? '' }))
    resetApprovalsIfNeeded('type')
  }

  function send() {
    const t = draft.trim()
    if (!t) return
    setMessages((m) => [...m, { who: 'You', mine: true, text: t }])
    setDraft('')
  }

  function pullChat() {
    setPlan((p) => ({ ...p, ...PULLED_FROM_CHAT }))
    setPulled(true)
    setTab('plan')
  }

  function toggleApprove(id: string) {
    setResetNote(false)
    setApprovals((a) => ({ ...a, [id]: !a[id] }))
  }

  // Plain-language summary for the approval step.
  const summary = [
    currentType ? currentType.label : 'Collaboration',
    plan.goal && `— ${plan.goal}`,
    plan.date && !HAS_CONFLICT(plan.date) && `· ${plan.date}`,
    plan.venue && `· ${plan.venue}`,
  ].filter(Boolean).join(' ')

  return (
    // Fills whatever the shell gives it. (Was `h-[74vh] md:h-[600px]` — a fixed
    // card that ignored its parent, so the composer landed wherever 600px fell
    // and left dead space under it.)
    <div className="card-soft flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header — name, status, lead */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{collab.label}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-500">
            <Crown className="h-3 w-3 text-amber-500" /> Led by {leadName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!owned && (
            <button
              onClick={() => toggleIn('you')}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                imIn
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {imIn ? "✓ You're in" : "I'm in 👍"}
            </button>
          )}
          <StatusPill status={status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-stone-200 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ['chat', 'Chat', MessageSquare],
          ['plan', 'Plan', ListChecks],
          ['people', 'Participants', Users],
          // Event + Attendees only once the collab has become a real event.
          ...(published ? ([['event', 'Event', Calendar], ['attendees', 'Attendees', Ticket]] as const) : []),
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-medium ${
              activeTab === key ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'event' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CollabEventTab event={demoEvent} hostMemberId="demo" canEdit={owned} demo onSaved={() => {}} />
        </div>
      ) : activeTab === 'attendees' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EventAttendees event={demoEvent} emailReady={false} demo />
        </div>
      ) : activeTab === 'people' ? (
        <PeopleTab inSet={inSet} toggleIn={toggleIn} leadName={leadName} locked={published} owned={owned} />
      ) : activeTab === 'chat' ? (
        <ChatTab
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          send={send}
          report={report}
          pulled={pulled}
          pullChat={pullChat}
        />
      ) : (
        <PlanTab
          plan={plan}
          setField={setField}
          typeKey={typeKey}
          pickType={pickType}
          requiredSet={requiredSet}
          report={report}
          currentTypeSpecifics={currentType?.specifics ?? []}
          tasks={tasks}
          setTasks={setTasks}
          approvals={approvals}
          requiredApprovers={requiredApprovers}
          approvedCount={approvedCount}
          allApproved={allApproved}
          toggleApprove={toggleApprove}
          resetNote={resetNote}
          summary={summary}
          canCreate={canCreate}
          owned={owned}
          leadName={leadName}
          published={published}
          onCreate={() => setPublished(true)}
        />
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'Published' ? 'bg-emerald-50 text-emerald-700'
      : status === 'Awaiting Approval' ? 'bg-amber-50 text-amber-700'
        : 'bg-stone-100 text-stone-600'
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{status}</span>
}

// ── Participants tab ─────────────────────────────────────────────────────────
// The three states, kept distinct on purpose:
//   Invited — sent, no answer yet.
//   Joined  — accepted, which only opened the room. NOT a commitment.
//   In 👍   — said "I'm in" here in the chat. This is who the event is built from.
function PeopleTab({
  inSet,
  toggleIn,
  leadName,
  locked = false,
  owned = true,
}: {
  inSet: Set<string>
  toggleIn: (id: string) => void
  leadName: string
  // Once the event is created the lineup locks — the roster switches from
  // "in / joined / invited" to "who's locked in vs who's asking to get on now".
  locked?: boolean
  owned?: boolean
}) {
  const state = (p: (typeof PARTICIPANTS)[number]) =>
    p.pending ? 'invited' : inSet.has(p.id) ? 'in' : 'joined'

  // A demo request that arrived AFTER the lineup locked, so the "Asking to join"
  // section has something to show. Host (owned) can Add / Not now.
  const [askers, setAskers] = useState<{ id: string; name: string; role: string }[]>([
    { id: 'ask-1', name: 'Taquería La Luz', role: 'Food vendor' },
  ])

  if (locked) {
    const lineup = PARTICIPANTS.filter((p) => state(p) === 'in')
    return (
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>
          <p className="section-label mb-1">On the lineup · {lineup.length}</p>
          <p className="mb-2 text-[11px] text-stone-400">Locked in when the event was created.</p>
          <div className="space-y-1.5">
            {lineup.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[11px] font-semibold text-stone-500">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-stone-900">{p.id === 'you' ? 'You' : p.name}</span>
                    {p.lead && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-stone-500">{p.role}</span>
                </span>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Locked in
                </span>
              </div>
            ))}
          </div>
        </div>

        {askers.length > 0 && (
          <div>
            <p className="section-label mb-1 text-amber-500">Asking to join · {askers.length}</p>
            <p className="mb-2 text-[11px] text-stone-400">
              Requested a spot after the lineup locked — {owned ? 'you decide' : 'the host decides'}.
            </p>
            <div className="space-y-1.5">
              {askers.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[11px] font-semibold text-stone-500">
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-stone-900">{a.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-stone-500">{a.role}</span>
                  </span>
                  {owned ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => setAskers((xs) => xs.filter((x) => x.id !== a.id))}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAskers((xs) => xs.filter((x) => x.id !== a.id))}
                        className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Not now
                      </button>
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Waiting on the host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const groups = [
    { key: 'in', label: 'In', hint: 'Committed — these are who the event is built from.' },
    { key: 'joined', label: 'Joined', hint: 'In the room, but haven’t said they’re in yet.' },
    { key: 'invited', label: 'Invited', hint: 'Waiting on an answer.' },
  ] as const

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
      {groups.map((g) => {
        const rows = PARTICIPANTS.filter((p) => state(p) === g.key)
        if (rows.length === 0) return null
        return (
          <div key={g.key}>
            <p className="section-label mb-1">
              {g.label} · {rows.length}
            </p>
            <p className="mb-2 text-[11px] text-stone-400">{g.hint}</p>
            <div className="space-y-1.5">
              {rows.map((p) => {
                const me = p.id === 'you'
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-100 text-[11px] font-semibold text-stone-500">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-stone-900">{p.name}</span>
                        {p.lead && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-stone-500">{p.role}</span>
                    </span>
                    {me ? (
                      <button
                        onClick={() => toggleIn('you')}
                        className={
                          'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ' +
                          (inSet.has('you')
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border border-stone-300 text-stone-700 hover:bg-stone-50')
                        }
                      >
                        {inSet.has('you') ? '✓ You’re in' : 'I’m in 👍'}
                      </button>
                    ) : (
                      <StateChip state={state(p)} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-[11px] leading-snug text-stone-400">
        {leadName === 'You' ? 'You' : leadName} created this collaboration. Only people who are{' '}
        <span className="font-medium text-stone-500">in</span> join the event lineup when it&apos;s created.
      </p>
    </div>
  )
}

function StateChip({ state }: { state: 'in' | 'joined' | 'invited' }) {
  const map = {
    in: { label: '👍 In', cls: 'bg-emerald-50 text-emerald-700' },
    joined: { label: 'Joined', cls: 'bg-stone-100 text-stone-600' },
    invited: { label: 'Invited', cls: 'bg-amber-50 text-amber-700' },
  }[state]
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${map.cls}`}>{map.label}</span>
}

// ── Chat tab ─────────────────────────────────────────────────────────────────
function ChatTab({
  messages, draft, setDraft, send, report, pulled, pullChat,
}: {
  messages: ChatMsg[]
  draft: string
  setDraft: (v: string) => void
  send: () => void
  report: ReturnType<typeof coordinatorReport>
  pulled: boolean
  pullChat: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Coordinator nudge */}
      <div className="shrink-0 border-b border-stone-100 bg-indigo-50/50 px-4 py-2.5">
        <p className="flex items-start gap-2 text-[12px] leading-snug text-stone-600">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-stone-800">AI coordinator:</span> {report.nextStep}
          </span>
          <button
            onClick={pullChat}
            className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
          >
            {pulled ? 'Pull again' : 'Pull chat into Plan'}
          </button>
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={'max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug ' + (m.mine ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-800')}>
              {!m.mine && <span className="block text-[10px] font-semibold text-stone-400">{m.who}</span>}
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send() }}
        className="flex shrink-0 items-center gap-2 border-t border-stone-100 px-3 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group…"
          className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm focus:border-indigo-300 focus:bg-white focus:outline-none"
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

// ── Plan tab ─────────────────────────────────────────────────────────────────
function PlanTab(props: {
  plan: PlanState
  setField: (k: PlanFieldKey, v: string) => void
  typeKey: CollabTypeKey | ''
  pickType: (k: CollabTypeKey) => void
  requiredSet: Set<PlanFieldKey>
  report: ReturnType<typeof coordinatorReport>
  currentTypeSpecifics: string[]
  tasks: DemoTask[]
  setTasks: (fn: (t: DemoTask[]) => DemoTask[]) => void
  approvals: Record<string, boolean>
  requiredApprovers: typeof PARTICIPANTS
  approvedCount: number
  allApproved: boolean
  toggleApprove: (id: string) => void
  resetNote: boolean
  summary: string
  canCreate: boolean
  owned: boolean
  leadName: string
  published: boolean
  onCreate: () => void
}) {
  const {
    plan, setField, typeKey, pickType, requiredSet, report, currentTypeSpecifics,
    tasks, setTasks, approvals, requiredApprovers, approvedCount, allApproved,
    toggleApprove, resetNote, summary, canCreate, owned, leadName, published, onCreate,
  } = props

  if (published) return <PublishedCard summary={summary} />

  const groups = ['Who', 'What', 'When & where', 'Money', 'Logistics'] as const

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
      {/* Coordinator panel */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-800">
          <Sparkles className="h-3.5 w-3.5" /> AI coordinator
        </p>
        <p className="mt-1 text-[13px] text-stone-700">{report.nextStep}</p>
        {report.conflicts.map((c, i) => (
          <p key={i} className="mt-1.5 flex items-start gap-1.5 text-[12px] text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c}
          </p>
        ))}
        {report.missing.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-stone-500">
            Still needed:
            {report.missing.map((m) => (
              <span key={m} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{m}</span>
            ))}
          </p>
        )}
        {currentTypeSpecifics.length > 0 && (
          <p className="mt-2 text-[11px] text-stone-400">Type checklist: {currentTypeSpecifics.join(' · ')}</p>
        )}
      </div>

      {/* Type picker */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Collaboration type</p>
        <div className="flex flex-wrap gap-1.5">
          {COLLAB_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => pickType(t.key)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                typeKey === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      {groups.map((g) => {
        const fields = PLAN_FIELDS.filter((f) => f.group === g && f.key !== 'type')
        if (fields.length === 0) return null
        return (
          <div key={g}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{g}</p>
            <div className="space-y-2">
              {fields.map((f) => {
                const v = plan[f.key]
                const required = requiredSet.has(f.key)
                const state = HAS_CONFLICT(v) ? 'conflict' : FILLED(v) ? 'filled' : required ? 'missing' : 'empty'
                return (
                  <div key={f.key} className="rounded-xl border border-stone-200 bg-white p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-stone-700">
                        {f.label}
                        {required && <span className="ml-1 text-rose-400">*</span>}
                      </span>
                      <FieldChip state={state} />
                    </div>
                    <input
                      value={v}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Tasks */}
      <TasksSection tasks={tasks} setTasks={setTasks} />

      {/* Approvals */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          Approvals · {approvedCount} of {requiredApprovers.length}
        </p>
        {resetNote && (
          <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Plan changed — approvals were reset. Everyone re-approves.
          </p>
        )}
        <p className="mb-2 rounded-lg bg-stone-50 px-3 py-2 text-[12px] italic text-stone-600">“{summary}”</p>
        <div className="space-y-1.5">
          {requiredApprovers.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
              <span className="min-w-0 text-[13px] text-stone-800">
                {p.name} <span className="text-stone-400">· {p.role}</span>
              </span>
              <button
                onClick={() => toggleApprove(p.id)}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  approvals[p.id] ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-900 text-white hover:bg-stone-800'
                }`}
              >
                {approvals[p.id] ? <><Check className="h-3.5 w-3.5" /> Approved</> : `Approve as ${p.name === 'You' ? 'you' : p.name.split(' ')[0]}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create Event — only the lead creates it; participants just approve. */}
      {owned ? (
        <button
          onClick={canCreate ? onCreate : undefined}
          disabled={!canCreate}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            canCreate ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-stone-100 text-stone-400'
          }`}
        >
          {canCreate ? <CalendarPlus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {canCreate ? 'Create Event' : 'Create Event — finish the plan & approvals'}
        </button>
      ) : (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-[13px] text-stone-500">
          <Lock className="h-4 w-4 shrink-0" />
          {leadName} creates the event once everyone’s in and the plan’s approved.
        </p>
      )}
    </div>
  )
}

function FieldChip({ state }: { state: 'filled' | 'missing' | 'conflict' | 'empty' }) {
  if (state === 'filled') return <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600"><Check className="h-3 w-3" /> set</span>
  if (state === 'conflict') return <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600"><AlertTriangle className="h-3 w-3" /> conflict</span>
  if (state === 'missing') return <span className="text-[10px] font-medium text-amber-600">needed</span>
  return <span className="text-[10px] text-stone-300">optional</span>
}

function TasksSection({ tasks, setTasks }: { tasks: DemoTask[]; setTasks: (fn: (t: DemoTask[]) => DemoTask[]) => void }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(PARTICIPANTS[0].id)
  const [due, setDue] = useState('')

  function add() {
    if (!title.trim()) return
    setTasks((t) => [...t, { id: `t${t.length + 1}-${title.slice(0, 4)}`, title: title.trim(), assignee, due: due.trim() || 'TBD', done: false }])
    setTitle(''); setDue('')
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Tasks</p>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <button
              onClick={() => setTasks((list) => list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${t.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300'}`}
              aria-label={t.done ? 'Mark not done' : 'Mark done'}
            >
              {t.done && <Check className="h-3 w-3" />}
            </button>
            <span className={`min-w-0 flex-1 text-[13px] ${t.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{t.title}</span>
            <span className="shrink-0 text-[11px] text-stone-400">{nameFor(t.assignee).split(' ')[0]} · {t.due}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] focus:border-indigo-300 focus:bg-white focus:outline-none" />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12px] text-stone-700">
          {PARTICIPANTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Due" className="w-16 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-[12px] focus:border-indigo-300 focus:bg-white focus:outline-none" />
        <button onClick={add} className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-stone-800">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  )
}

function PublishedCard({ summary }: { summary: string }) {
  const generated = [
    'Public event page', 'Lineup from who’s in', 'RSVP / tickets', 'Run-of-show schedule',
    'Tasks & due dates', 'Reminders to each participant', 'Promo copy for socials',
  ]
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <PartyPopper className="h-7 w-7" />
        </span>
        <h3 className="mt-3 text-base font-semibold text-stone-900">Event created & published</h3>
        <p className="mt-1 text-[13px] text-stone-500">“{summary}”</p>
        <p className="mt-4 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">Generated in one click</p>
        <ul className="mt-2 space-y-1.5 text-left">
          {generated.map((g) => (
            <li key={g} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-700">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" /> {g}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
