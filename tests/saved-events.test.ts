import { describe, it, expect, afterAll } from 'vitest'
import { getSavedEventIds, saveEvent, unsaveEvent } from '@/lib/saved-events'
import {
  logModerationEvent,
  listModerationEvents,
  resolveModerationEvent,
} from '@/lib/moderation'

// Live integration tests against the real Supabase project, using synthetic
// ids that no real user or event can collide with.

const USER = 'test_user_saved_events'
const EVENT_A = 'test-event-a'
const EVENT_B = 'test-event-b'

afterAll(async () => {
  await Promise.all([unsaveEvent(USER, EVENT_A), unsaveEvent(USER, EVENT_B)])
})

describe('saved events', () => {
  it('saves, lists and unsaves', async () => {
    await saveEvent(USER, EVENT_A)
    expect(await getSavedEventIds(USER)).toContain(EVENT_A)
    await unsaveEvent(USER, EVENT_A)
    expect(await getSavedEventIds(USER)).not.toContain(EVENT_A)
  })

  it('is idempotent — a double-tap is one star, not a duplicate row or an error', async () => {
    await saveEvent(USER, EVENT_B)
    await saveEvent(USER, EVENT_B)
    const ids = await getSavedEventIds(USER)
    expect(ids.filter((id) => id === EVENT_B)).toHaveLength(1)
  })

  it('unsaving something that was never saved is a no-op, not a throw', async () => {
    await expect(unsaveEvent(USER, 'test-event-never-saved')).resolves.toBeUndefined()
  })

  it('keeps one user out of another user\'s list', async () => {
    await saveEvent(USER, EVENT_A)
    expect(await getSavedEventIds('test_user_someone_else')).not.toContain(EVENT_A)
  })
})

describe('moderation event log', () => {
  it('records a screening decision and closes it', async () => {
    const id = await logModerationEvent({
      surface: 'post',
      authorId: 'test_user_moderation',
      action: 'review',
      categories: ['harassment'],
      scores: { harassment: 0.51 },
      text: 'synthetic test row — safe to delete',
      imageCount: 1,
      flaggedImages: true,
    })
    expect(id).toBeTruthy()

    const pending = await listModerationEvents('pending')
    const mine = pending.find((e) => e.id === id)
    expect(mine).toBeTruthy()
    expect(mine?.action).toBe('review')
    expect(mine?.categories).toContain('harassment')
    // The audit trail is the point: the score that caused the hold must survive.
    expect(mine?.scores?.harassment).toBeCloseTo(0.51)
    expect(mine?.flagged_images).toBe(true)

    await resolveModerationEvent(id!, 'dismissed')
    const stillPending = await listModerationEvents('pending')
    expect(stillPending.find((e) => e.id === id)).toBeUndefined()
  })
})
