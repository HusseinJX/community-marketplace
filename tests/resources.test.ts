import { describe, it, expect } from 'vitest'
import { recommendResources, RESOURCES, resourcesForPrompt, searchUrl } from '@/lib/resources'
import type { BusinessContext } from '@/lib/business-context'

// Pure, deterministic — no OpenAI/Supabase calls, so this is free to run.
function ctx(name: string, blob: string): BusinessContext {
  return { memberId: 'm1', businessName: name, assistantEnabled: true, persona: null, knowledgeBlob: blob }
}

describe('recommendResources', () => {
  it('always recommends baseline resources even for a thin profile', () => {
    const recs = recommendResources(ctx('Some Shop', 'No additional information.'))
    const ids = recs.map((r) => r.resource.id)
    // The two `always: true` seeds should surface for anyone.
    expect(ids).toContain('sf-office-small-business')
    expect(ids).toContain('sf-library-business-center')
  })

  it("gives a restaurant the induction + green picks, ranked above baseline", () => {
    const recs = recommendResources(
      ctx('Taqueria La Best', '## Business\nCategory: restaurant\n## Offerings\nMenu highlights: tacos cooked fresh in our kitchen')
    )
    const ids = recs.map((r) => r.resource.id)
    expect(ids).toContain('sf-induction-cooktop-program')
    expect(ids).toContain('sf-green-business-program')
    // Category/keyword matches must outrank an always-only baseline resource.
    const induction = recs.find((r) => r.resource.id === 'sf-induction-cooktop-program')!
    const baseline = recs.find((r) => r.resource.id === 'sf-library-business-center')!
    expect(induction.score).toBeGreaterThan(baseline.score)
    expect(induction.reasons.join(' ').toLowerCase()).toContain('restaurant')
  })

  it('respects the limit', () => {
    const recs = recommendResources(ctx('X', 'Category: restaurant kitchen storefront'), { limit: 2 })
    expect(recs.length).toBeLessThanOrEqual(2)
  })

  it('passing an explicit category produces a clean reason', () => {
    const recs = recommendResources(ctx('X', 'storefront shop'), { category: 'retail' })
    const acc = recs.find((r) => r.resource.id === 'sf-accessibility-guide')
    expect(acc).toBeTruthy()
    expect(acc!.reasons.join(' ')).toContain("You're a retail")
  })
})

describe('catalog integrity', () => {
  it('every resource has a stable id and either a url or a searchHint', () => {
    const ids = new Set<string>()
    for (const r of RESOURCES) {
      expect(r.id).toBeTruthy()
      expect(ids.has(r.id)).toBe(false) // unique
      ids.add(r.id)
      // Never a fabricated link: must have a real url OR a search fallback.
      expect(r.url || r.searchHint).toBeTruthy()
    }
  })

  it('searchUrl builds a query for unlinked resources', () => {
    const unlinked = RESOURCES.find((r) => !r.url)!
    expect(searchUrl(unlinked)).toContain('https://www.google.com/search?q=')
  })

  it('resourcesForPrompt lists every resource by id', () => {
    const prompt = resourcesForPrompt()
    for (const r of RESOURCES) expect(prompt).toContain(`[${r.id}]`)
  })
})
