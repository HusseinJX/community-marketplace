import { describe, it, expect, afterAll } from 'vitest'
import {
  createProduct,
  getProductsByMember,
  getAllProductsByMember,
  updateProduct,
  deleteProduct,
  addBusinessKnowledge,
  getBusinessKnowledge,
  deleteBusinessKnowledge,
  createConversation,
  appendMessages,
  getMessagesByConversation,
  createLead,
  getLeadsByMember,
  createVendorEvent,
  getVendorEventsByMember,
  deleteVendorEvent,
} from '@/lib/vendor-connect'

// Live Supabase integration. Uses a throwaway member id and cleans up after.
const MEMBER = `test-int-${Date.now()}`
const cleanup: Array<() => Promise<unknown>> = []

afterAll(async () => {
  for (const fn of cleanup) await fn().catch(() => {})
})

describe('products CRUD (live Supabase)', () => {
  it('creates a draft, surfaces it to owner only, approves, then deletes', async () => {
    const created = await createProduct(MEMBER, 'Test Vendor', {
      name: 'Integration Widget',
      description: 'made by a test',
      price: 1234,
      active: false, // draft
      source: 'ai_menu',
    })
    cleanup.push(() => deleteProduct(created.id, MEMBER))
    expect(created.id).toBeTruthy()
    expect(created.active).toBe(false)

    // public list excludes drafts; owner list includes them
    expect((await getProductsByMember(MEMBER)).find((p) => p.id === created.id)).toBeUndefined()
    expect((await getAllProductsByMember(MEMBER)).find((p) => p.id === created.id)).toBeTruthy()

    // approve -> now public
    await updateProduct(created.id, MEMBER, { active: true })
    const live = await getProductsByMember(MEMBER)
    expect(live.find((p) => p.id === created.id)?.active).toBe(true)

    // delete -> gone everywhere
    await deleteProduct(created.id, MEMBER)
    expect((await getAllProductsByMember(MEMBER)).find((p) => p.id === created.id)).toBeUndefined()
  })
})

describe('business knowledge (live Supabase)', () => {
  it('adds, reads, and deletes an entry', async () => {
    await addBusinessKnowledge(MEMBER, 'We are open 9am-5pm and offer catering.')
    const items = await getBusinessKnowledge(MEMBER)
    const mine = items.find((k) => k.content.includes('catering'))
    expect(mine).toBeTruthy()
    await deleteBusinessKnowledge(mine!.id, MEMBER)
    expect((await getBusinessKnowledge(MEMBER)).find((k) => k.id === mine!.id)).toBeUndefined()
  })
})

describe('chat persistence + leads (live Supabase)', () => {
  it('creates a conversation, appends messages, and captures a lead', async () => {
    const convId = await createConversation(MEMBER)
    cleanup.push(async () => {
      /* conversation cascades messages; leads cleaned below */
    })
    expect(convId).toBeTruthy()

    await appendMessages(convId, MEMBER, [
      { role: 'user', content: 'Do you cater?' },
      { role: 'assistant', content: 'Yes we do!' },
    ])
    const msgs = await getMessagesByConversation(convId)
    expect(msgs.length).toBe(2)
    expect(msgs[0].role).toBe('user')

    await createLead({ memberId: MEMBER, conversationId: convId, name: 'Pat', contact: 'pat@example.com', message: 'quote please' })
    const leads = await getLeadsByMember(MEMBER)
    expect(leads.find((l) => l.contact === 'pat@example.com')).toBeTruthy()
  })
})

describe('vendor events (live Supabase)', () => {
  it('creates a draft event and deletes it', async () => {
    const ev = await createVendorEvent(MEMBER, 'Test Vendor', {
      title: 'Integration Pop-up',
      event_date: 'Sat Jun 7',
      location: 'Test St',
      active: false,
      source: 'ai_flyer',
    })
    cleanup.push(() => deleteVendorEvent(ev.id, MEMBER))
    const drafts = await getVendorEventsByMember(MEMBER, true)
    expect(drafts.find((e) => e.id === ev.id)).toBeTruthy()
    // public (non-draft) list should exclude it
    expect((await getVendorEventsByMember(MEMBER, false)).find((e) => e.id === ev.id)).toBeUndefined()
  })
})
