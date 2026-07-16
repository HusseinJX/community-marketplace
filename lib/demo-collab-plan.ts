// Demo data + config for the interactive collaboration-room demo
// (components/vendor/CollabRoomDemo.tsx). Pure data + pure helpers — no backend,
// no AI API. The "AI coordinator" is coordinatorReport(): a deterministic
// function over the plan state, so the public demo never triggers a paid call.

export type PlanFieldKey =
  | 'lead'
  | 'partners'
  | 'type'
  | 'goal'
  | 'date'
  | 'venue'
  | 'capacity'
  | 'money'
  | 'responsibilities'
  | 'permits'
  | 'promotion'
  | 'cancellation'

export interface PlanField {
  key: PlanFieldKey
  label: string
  group: 'Who' | 'What' | 'When & where' | 'Money' | 'Logistics'
  placeholder: string
}

// The canonical field list, grouped for the Plan tab.
export const PLAN_FIELDS: PlanField[] = [
  { key: 'lead', label: 'Lead organizer', group: 'Who', placeholder: 'Who owns moving this forward?' },
  { key: 'partners', label: 'Partners & roles', group: 'Who', placeholder: 'Who’s in, and what each does' },
  { key: 'type', label: 'Collaboration type', group: 'What', placeholder: 'Pick a type above' },
  { key: 'goal', label: 'Goal & customer offer', group: 'What', placeholder: 'What are we putting on, and for whom?' },
  { key: 'date', label: 'Date & time', group: 'When & where', placeholder: 'e.g. Sat Aug 9, 5–10pm' },
  { key: 'venue', label: 'Venue', group: 'When & where', placeholder: 'Where does it happen?' },
  { key: 'capacity', label: 'Capacity', group: 'When & where', placeholder: 'How many people?' },
  { key: 'money', label: 'Costs, pay & revenue split', group: 'Money', placeholder: 'Who pays what, who gets what' },
  { key: 'responsibilities', label: 'Responsibilities', group: 'Logistics', placeholder: 'Who does which tasks' },
  { key: 'permits', label: 'Permits, equipment, setup & cleanup', group: 'Logistics', placeholder: 'What’s needed to run it' },
  { key: 'promotion', label: 'Promotion commitments', group: 'Logistics', placeholder: 'Who promotes, and how' },
  { key: 'cancellation', label: 'Cancellation plan', group: 'Logistics', placeholder: 'What if it falls through?' },
]

export type PlanState = Record<PlanFieldKey, string>

export type CollabTypeKey =
  | 'market-popup'
  | 'workshop'
  | 'paid-opportunity'
  | 'product-bundle'
  | 'venue-residency'
  | 'neighborhood-crawl'
  | 'shared-cost'

export interface CollabType {
  key: CollabTypeKey
  label: string
  // Required fields for this type — the checklist that gates Create Event.
  required: PlanFieldKey[]
  // A couple of type-specific checklist reminders (shown as coordinator hints).
  specifics: string[]
}

// Every type needs the core Who/What. The differences are in money, venue,
// capacity, permits — which is exactly what makes the checklists feel distinct.
const CORE: PlanFieldKey[] = ['lead', 'partners', 'type', 'goal']

export const COLLAB_TYPES: CollabType[] = [
  {
    key: 'market-popup',
    label: 'Market / pop-up',
    required: [...CORE, 'date', 'venue', 'money', 'permits', 'promotion'],
    specifics: ['Confirm booth/table layout', 'Vendor permit for the site', 'Rain plan'],
  },
  {
    key: 'workshop',
    label: 'Workshop',
    required: [...CORE, 'date', 'venue', 'capacity', 'money', 'responsibilities'],
    specifics: ['Materials list & who buys them', 'Ticket price & cap', 'Skill level / prerequisites'],
  },
  {
    key: 'paid-opportunity',
    label: 'Paid opportunity',
    required: [...CORE, 'date', 'money', 'responsibilities', 'cancellation'],
    specifics: ['Agreed pay & payment terms', 'Deliverables per party', 'Kill fee / cancellation terms'],
  },
  {
    key: 'product-bundle',
    label: 'Product bundle',
    required: [...CORE, 'money', 'promotion', 'responsibilities'],
    specifics: ['Bundle SKU & price', 'Revenue split %', 'Who fulfills / ships'],
  },
  {
    key: 'venue-residency',
    label: 'Venue residency',
    required: [...CORE, 'date', 'venue', 'money', 'cancellation'],
    specifics: ['Residency dates & recurrence', 'Rent / revenue share', 'Exit terms'],
  },
  {
    key: 'neighborhood-crawl',
    label: 'Neighborhood crawl',
    required: [...CORE, 'date', 'promotion', 'responsibilities'],
    specifics: ['Stop order & map', 'Passport / punch-card', 'Shared hashtag & promo dates'],
  },
  {
    key: 'shared-cost',
    label: 'Shared-cost collaboration',
    required: [...CORE, 'money', 'responsibilities', 'cancellation'],
    specifics: ['Total budget & split', 'Who fronts costs', 'Reconciliation after'],
  },
]

export const typeLabel = (key: string): string =>
  COLLAB_TYPES.find((t) => t.key === key)?.label ?? 'Collaboration'

export interface Participant {
  id: string
  name: string
  role: string
  lead?: boolean
  // Pending invitees aren't required approvers yet.
  pending?: boolean
}

// The Night Market cast — same as the collab list + progression teaser.
export const PARTICIPANTS: Participant[] = [
  { id: 'you', name: 'You', role: 'Organizer', lead: true },
  { id: 'demo-muralist', name: 'Dani Cruz', role: 'Artist' },
  { id: 'demo-cantina', name: 'El Tri Cantina', role: 'Food' },
  { id: 'demo-greenhouse', name: 'Greenhouse Project', role: 'Partner', pending: true },
]

export interface ChatMsg {
  who: string
  mine?: boolean
  text: string
}

// Seed chat — the decisions live in here; "Pull chat into Plan" turns them into
// structured fields. Note the deliberate DATE CONFLICT (Aug 9 vs Aug 16) that
// the coordinator flags until resolved.
export const SEED_CHAT: ChatMsg[] = [
  { who: 'You', mine: true, text: 'Thinking a night market on Valencia — food, art, live music.' },
  { who: 'Dani Cruz', text: "I'm in! I'll do a live mural wall." },
  { who: 'El Tri Cantina', text: "We'll run a taco + agua fresca stand 🌮 Aug 9 works for us." },
  { who: 'You', mine: true, text: 'I was picturing Aug 16 actually — let’s lock the date.' },
  { who: 'Dani Cruz', text: 'Either weekend is fine for me. Someone needs to pull the vendor permit though.' },
]

// The plan as chat leaves it: core filled, venue/capacity/money/permits/promo
// still open, and `date` holding the unresolved conflict.
export const SEED_PLAN: PlanState = {
  lead: 'You',
  partners: 'You (organizer), Dani Cruz (live mural), El Tri Cantina (food)',
  type: '',
  goal: 'Valencia St night market — food, art & live music for the neighborhood',
  date: '⚠ Aug 9 or Aug 16 — not locked',
  venue: '',
  capacity: '',
  money: '',
  responsibilities: '',
  permits: '',
  promotion: '',
  cancellation: '',
}

// What "Pull chat into Plan" fills — the agreed-so-far details. Leaves the
// genuinely-undecided fields empty so the coordinator still has gaps to guide.
export const PULLED_FROM_CHAT: Partial<PlanState> = {
  partners: 'You (organizer), Dani Cruz (live mural wall), El Tri Cantina (tacos + aguas frescas)',
  responsibilities: 'Dani: mural wall · El Tri: food stand · You: permit + promo',
  permits: 'Vendor permit for Valencia St — owner TBD',
}

export interface DemoTask {
  id: string
  title: string
  assignee: string // participant id
  due: string
  done: boolean
}

export const SEED_TASKS: DemoTask[] = [
  { id: 't1', title: 'Pull the Valencia St vendor permit', assignee: 'you', due: 'Jul 25', done: false },
  { id: 't2', title: 'Confirm mural wall materials', assignee: 'demo-muralist', due: 'Jul 28', done: false },
]

// Fields that count as "important" — editing one after approvals resets them.
export const APPROVAL_RESETTING_FIELDS: PlanFieldKey[] = [
  'type', 'date', 'venue', 'money', 'capacity',
]

const FILLED = (v: string) => v.trim().length > 0
const HAS_CONFLICT = (v: string) => v.includes('⚠')

export interface CoordinatorReport {
  missing: string[]
  conflicts: string[]
  nextStep: string
  complete: boolean
}

// The "AI coordinator": deterministic read of plan completeness for a given
// type. Pure — no API, no randomness.
export function coordinatorReport(plan: PlanState, typeKey: string): CoordinatorReport {
  const type = COLLAB_TYPES.find((t) => t.key === typeKey)
  const required = type?.required ?? CORE
  const labelFor = (k: PlanFieldKey) => PLAN_FIELDS.find((f) => f.key === k)?.label ?? k

  const missing: string[] = []
  const conflicts: string[] = []
  for (const k of required) {
    const v = plan[k] ?? ''
    if (HAS_CONFLICT(v)) conflicts.push(`${labelFor(k)}: two options on the table — pick one.`)
    else if (!FILLED(v)) missing.push(labelFor(k))
  }

  const complete = missing.length === 0 && conflicts.length === 0
  let nextStep: string
  if (!typeKey) nextStep = 'Pick a collaboration type so I know which checklist applies.'
  else if (conflicts.length) nextStep = 'Resolve the conflict, then we can move to approvals.'
  else if (missing.length) nextStep = `Fill in ${missing[0]} next — ${missing.length} field${missing.length > 1 ? 's' : ''} left.`
  else nextStep = 'Everything’s covered. Send it to the group for approval.'

  return { missing, conflicts, nextStep, complete }
}
