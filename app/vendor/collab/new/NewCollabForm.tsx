'use client'

import { useRouter } from 'next/navigation'
import { CollabComposer } from '@/components/vendor/CollabComposer'

// Client shell for the New collaboration PAGE. Renders the same shared
// CollabComposer the dashboard uses; on success it drops you into Collabs where
// the new collaboration now lives. No collabs bar here, so the composer draws
// its own For-you / Search tabs.
export function NewCollabForm({
  memberId,
  isAdmin,
  demo,
  canInvite,
  existingCount,
}: {
  memberId: string
  isAdmin: boolean
  demo: boolean
  canInvite: boolean
  existingCount: number
}) {
  const router = useRouter()
  return (
    <CollabComposer
      memberId={memberId}
      isAdmin={isAdmin}
      demo={demo}
      canInvite={canInvite}
      source="network"
      collaborationsBefore={existingCount}
      // Land in the new collaboration's chat, not on the list.
      onDone={({ occasionId }) =>
        router.push(`/vendor/messages?tab=collabs&collab=${encodeURIComponent(occasionId)}`)
      }
    />
  )
}
