'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, MessageSquare } from 'lucide-react'
import { CollabsGate } from '@/components/vendor/CollabsGate'
import { NetworkManager } from '@/app/vendor/network/NetworkManager'
import { CustomerInbox } from './CustomerInbox'
import { useVendorActivity } from '@/lib/data-hooks'
import { countUnread, loadSeen, saveSeen, totalUnread, type SeenMap } from '@/lib/unread'

// ONE inbox.
//
// Collabs and Messages used to be separate top-level tabs, which meant a
// business with an unread message had to guess which of two inboxes it was in.
// They're all conversations, so they're all here:
//   Collaborations — your collaborator rooms + invites
//   Customers      — customer DMs the AI agent handled
//   Assistant      — your own ChatGPT-style threads with that same AI agent
// Discovery (who to team up with) stays on Home. Home = find, Messages = talk.

type Section = 'collabs' | 'customers'

function isSection(v: string | null): v is Section {
  return v === 'collabs' || v === 'customers'
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
  // When a conversation is open in any section (a collab thread, a customer
  // transcript, an assistant chat), the section renders full-screen and we hide
  // the "Messages" title + tab bar. The open section owns its own back button.
  const [chatOpen, setChatOpen] = useState(false)

  // Tell the layout's nav row to get out of the way (globals.css reads this).
  // The vendor layout is a server component and can't see this state, and the
  // body outlives this component, so the cleanup matters: leave the flag set and
  // the portal nav stays hidden on every page you visit next.
  useEffect(() => {
    document.body.dataset.chatOpen = chatOpen ? 'true' : 'false'
    return () => {
      delete document.body.dataset.chatOpen
    }
  }, [chatOpen])

  // Unread badges. The shell owns this because the badge for a tab has to show
  // while you're standing in a DIFFERENT tab — the other sections aren't even
  // mounted. Activity comes from the server (SWR-cached, so returning to
  // Messages paints badges instantly); "last seen" is local (see lib/unread).
  const { collab: collabActivity, customer: customerActivity } = useVendorActivity(memberId, isAdmin)
  const [seenCollab, setSeenCollab] = useState<SeenMap>({})
  const [seenCustomer, setSeenCustomer] = useState<SeenMap>({})

  // Deep-linkable (?tab=customers), so the old /vendor/network links can land
  // straight on Collaborations.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (isSection(q)) setSection(q)
    // In the demo, read state is memory-only (see markSeen) — so don't restore it.
    if (adminDemo) return
    setSeenCollab(loadSeen('collab'))
    setSeenCustomer(loadSeen('customer'))
  }, [adminDemo])

  const unreadByRoom = useMemo(() => countUnread(collabActivity, seenCollab), [collabActivity, seenCollab])
  const unreadByConvo = useMemo(
    () => countUnread(customerActivity, seenCustomer),
    [customerActivity, seenCustomer],
  )
  const collabUnread = totalUnread(unreadByRoom)
  const customerUnread = totalUnread(unreadByConvo)

  // Opening a thread marks it read, right now — no refetch needed.
  // Demo: keep it in memory only, so a reload brings the badges back and the
  // walkthrough can be run again. Real accounts persist per device.
  const markSeen = useCallback(
    (scope: 'collab' | 'customer', id: string) => {
      const setter = scope === 'collab' ? setSeenCollab : setSeenCustomer
      setter((prev) => {
        const next = { ...prev, [id]: new Date().toISOString() }
        if (!adminDemo) saveSeen(scope, next)
        return next
      })
    },
    [adminDemo],
  )

  const markCollabSeen = useCallback((id: string) => markSeen('collab', id), [markSeen])
  const markCustomerSeen = useCallback((id: string) => markSeen('customer', id), [markSeen])

  const pick = (next: Section) => {
    setChatOpen(false)
    setSection(next)
    const url = new URL(window.location.href)
    if (next === 'collabs') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url.toString())
  }

  const tabs: { key: Section; label: string; Icon: typeof Users; unread: number }[] = [
    { key: 'collabs', label: 'Collaborations', Icon: Users, unread: collabUnread },
    { key: 'customers', label: 'Customers', Icon: MessageSquare, unread: customerUnread },
  ]

  return (
    // A chat fills the screen between the vendor nav and the bottom nav so its
    // composer pins just above the bottom nav — no page scroll, nothing below.
    //
    // VERTICAL padding only. The layout drops its own `py-10` on this route, but
    // it ALWAYS supplies horizontal padding (VendorChrome) — so adding `px-6`
    // here stacked on top of it and left 40px of gutter each side of a 375px
    // phone, squeezing the content into 295px.
    <div
      className={chatOpen ? 'flex flex-col pt-4' : 'space-y-6 py-6 sm:py-10'}
      // An open chat hides the portal's nav row (see the body marker below), so
      // the only chrome left is the app's top + bottom nav — --app-chrome, not
      // --vendor-chrome.
      style={chatOpen ? { height: 'calc(100dvh - var(--app-chrome))' } : undefined}
    >
      {/* Title + tab bar hide while a conversation is open (full-screen chat). */}
      {!chatOpen && (
        <>
          <h1 className="text-xl font-semibold text-stone-900">Messages</h1>

          <div className="flex gap-1 overflow-x-auto border-b border-stone-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map(({ key, label, Icon, unread }) => (
              <button
                key={key}
                onClick={() => pick(key)}
                aria-current={section === key ? 'page' : undefined}
                className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-medium ${
                  section === key
                    ? 'border-indigo-500 text-indigo-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {unread > 0 && (
                  <span
                    aria-label={`${unread} unread`}
                    className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold tabular-nums text-white"
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* With a chat open this is the only child, so it takes the whole box —
          min-h-0 lets the chat's own scroller shrink inside the flex parent
          instead of overflowing it (without it, flex children refuse to go below
          their content height and the composer gets pushed off-screen). */}
      <div className={chatOpen ? 'flex min-h-0 flex-1 flex-col' : 'contents'}>
        {section === 'collabs' && (
          <CollabsGate plan={plan} adminDemo={adminDemo}>
            <NetworkManager
              memberId={memberId}
              isAdmin={isAdmin}
              onChatOpenChange={setChatOpen}
              unreadByRoom={unreadByRoom}
              onRoomSeen={markCollabSeen}
            />
          </CollabsGate>
        )}
        {section === 'customers' && (
          <CustomerInbox onChatOpenChange={setChatOpen} unreadByConvo={unreadByConvo} onConvoSeen={markCustomerSeen} />
        )}
      </div>
    </div>
  )
}
