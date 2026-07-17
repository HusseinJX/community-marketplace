import { it, expect } from 'vitest'
import { collabEventDay } from '@/lib/collab-status'
import type { CollaborationSummary } from '@/lib/collab-network'

const c = (eventDate: string | null) => ({ eventDate }) as CollaborationSummary

it('formats day/month across the real event_date shapes', () => {
  // The date picker's ISO — the timezone trap. Must be the 9th, not the 8th.
  expect(collabEventDay(c('2026-08-09'))).toBe('9/8')
  expect(collabEventDay(c('2026-08-09T00:00:00'))).toBe('9/8')
  expect(collabEventDay(c('2026-12-19'))).toBe('19/12')
  // Demo / connector display strings.
  expect(collabEventDay(c('Aug 9, 2026'))).toBe('9/8')
  // Free text off a flyer scan — no date beats a wrong date.
  expect(collabEventDay(c('next saturday'))).toBeNull()
  expect(collabEventDay(c(''))).toBeNull()
  expect(collabEventDay(c(null))).toBeNull()
})
