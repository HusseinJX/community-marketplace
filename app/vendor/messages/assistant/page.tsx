import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { VendorAgentChat } from '@/components/vendor/VendorAgentChat'

export const metadata = { title: 'Your AI agent' }

export default async function VendorAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>
}) {
  const { memberId } = await searchParams
  const actor = await resolveActor(memberId ?? null)
  if (!actor) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        Link your business profile to chat with your agent.
      </div>
    )
  }

  let name = 'your business'
  try {
    const { member } = await getMember(actor.memberId)
    const p = (member?.profile ?? {}) as Record<string, unknown>
    name = (p.businessName as string) || (p.name as string) || name
  } catch {
    /* connector down — generic label */
  }

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white"
      style={{ height: 'calc(100dvh - 14rem)' }}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-stone-100 bg-white px-4 py-3">
        <Link
          href="/vendor/messages"
          className="rounded-full p-1 text-stone-500 hover:bg-stone-100"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">Your AI agent</p>
          <p className="truncate text-[11px] text-emerald-600">● Always on</p>
        </div>
      </div>
      <VendorAgentChat memberId={actor.memberId} memberName={name} />
    </div>
  )
}
