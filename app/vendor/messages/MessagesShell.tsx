'use client'

import { useEffect, useState } from 'react'
import { Users, MessageSquare, Sparkles } from 'lucide-react'
import { CollabsGate } from '@/components/vendor/CollabsGate'
import { NetworkManager } from '@/app/vendor/network/NetworkManager'
import { CustomerInbox } from './CustomerInbox'
import { AssistantConsole } from '@/components/vendor/AssistantConsole'
import { PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// ONE inbox.
//
// Collabs and Messages used to be separate top-level tabs, which meant a
// business with an unread message had to guess which of two inboxes it was in.
// They're all conversations, so they're all here:
//   Collaborations — your collaborator rooms + invites
//   Customers      — customer DMs the AI agent handled
//   Assistant      — your own ChatGPT-style threads with that same AI agent
// Discovery (who to team up with) stays on Home. Home = find, Messages = talk.

type Section = 'collabs' | 'customers' | 'assistant'

function isSection(v: string | null): v is Section {
  return v === 'collabs' || v === 'customers' || v === 'assistant'
}

export function MessagesShell({
  memberId,
  isAdmin,
  plan,
  adminDemo,
}: {
  memberId: string
  isAdmin: boolean
  plan: string
  adminDemo: boolean
}) {
  const [section, setSection] = useState<Section>('collabs')

  // The customer-service AI agent is a Pro capability, so the Assistant tab only
  // shows on Pro. Read the shared preview tier so the plan toggle reflects here.
  const initialTier: Tier = plan === 'member' ? 'member' : plan === 'free' ? 'free' : 'pro'
  const [tier, setTier] = useState<Tier>(initialTier)
  useEffect(() => {
    const v = localStorage.getItem(PLAN_KEY)
    if (v === 'free' || v === 'member' || v === 'pro') setTier(v)
  }, [])
  const isPro = tier === 'pro'

  // Deep-linkable (?tab=customers), so the old /vendor/network links can land
  // straight on Collaborations.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (isSection(q)) setSection(q)
  }, [])

  // If the tier drops below Pro while on the Assistant tab, fall back.
  useEffect(() => {
    if (section === 'assistant' && !isPro) setSection('collabs')
  }, [section, isPro])

  const pick = (next: Section) => {
    setSection(next)
    const url = new URL(window.location.href)
    if (next === 'collabs') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url.toString())
  }

  const tabs: { key: Section; label: string; Icon: typeof Users }[] = [
    { key: 'collabs', label: 'Collaborations', Icon: Users },
    { key: 'customers', label: 'Customers', Icon: MessageSquare },
    // Assistant (chat with your customer-service AI agent) is Pro-only.
    ...(isPro ? [{ key: 'assistant' as Section, label: 'Assistant', Icon: Sparkles }] : []),
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-900">Messages</h1>

      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => pick(key)}
            aria-current={section === key ? 'page' : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-[13px] font-medium ${
              section === key
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {section === 'collabs' && (
        <CollabsGate plan={plan} adminDemo={adminDemo}>
          <NetworkManager memberId={memberId} isAdmin={isAdmin} />
        </CollabsGate>
      )}
      {section === 'customers' && <CustomerInbox />}
      {section === 'assistant' && isPro && <AssistantConsole memberId={memberId} />}
    </div>
  )
}
