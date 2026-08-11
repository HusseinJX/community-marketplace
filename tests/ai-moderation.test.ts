import { describe, it, expect } from 'vitest'
import { screenContent, policyCheck } from '@/lib/ai-moderation'

// Live integration tests — these call the real moderation API (which is free,
// so running them costs nothing) and the real chat model for the policy pass.
//
// The assertions are deliberately asymmetric. On harmful content we assert the
// exact verdict, because a miss there is the whole failure mode. On ordinary
// content we assert only "not blocked": a screener that holds a rude review for
// a human is doing its job, one that deletes it is not, and pinning the middle
// band to an exact value would make every threshold tweak a test failure.

const CAT_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/320px-Cat_November_2010-1a.jpg'

describe('screenContent', () => {
  it('allows ordinary community content', async () => {
    const r = await screenContent({ text: 'Taco night at the Mission spot, 6pm — bring friends!' })
    expect(r.action).toBe('allow')
  })

  it('allows a business promoting its own event', async () => {
    const r = await screenContent({
      text: 'Our bakery pop-up is this Saturday at 10am, 20% off all pastries.',
    })
    expect(r.action).toBe('allow')
  })

  it('blocks a violent threat', async () => {
    const r = await screenContent({ text: 'I am going to find you and beat you to death, you piece of trash' })
    expect(r.action).toBe('block')
    expect(r.categories.length).toBeGreaterThan(0)
  })

  it('blocks dehumanising hate speech', async () => {
    const r = await screenContent({ text: 'those immigrants are vermin and should be exterminated' })
    expect(r.action).toBe('block')
  })

  it('does not block mere rudeness', async () => {
    // The gap between "held" and "blocked" exists for exactly this input.
    const r = await screenContent({ text: 'this vendor is an idiot and their coffee is terrible' })
    expect(r.action).not.toBe('block')
  })

  it('screens images, not just text', async () => {
    const r = await screenContent({ text: 'our shop cat says hi', imageUrls: [CAT_IMAGE] })
    expect(r.action).toBe('allow')
    expect(r.flaggedImages).toBe(false)
  })

  it('is a no-op on empty content', async () => {
    const r = await screenContent({ text: '   ', imageUrls: [] })
    expect(r.action).toBe('allow')
    expect(r.reason).toBeNull()
  })

  it('ignores unscreenable image URLs rather than failing the write', async () => {
    // data: and relative URLs can't be fetched by the API; they must not throw.
    const r = await screenContent({ text: 'hello neighbours', imageUrls: ['/local/path.png', 'data:image/png;base64,AA'] })
    expect(r.action).toBe('allow')
  })

  it('fails OPEN when the screener is unavailable', async () => {
    const key = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      const r = await screenContent({ text: 'anything at all' })
      // Never hold the write on an outage — but say so, so the gap is loggable.
      expect(r.action).toBe('allow')
      expect(r.reason).toMatch(/screener_unavailable/)
    } finally {
      if (key) process.env.OPENAI_API_KEY = key
    }
  })
})

describe('policyCheck (spam/scam pass)', () => {
  it('is off unless MODERATION_POLICY_CHECK=1', async () => {
    const prev = process.env.MODERATION_POLICY_CHECK
    delete process.env.MODERATION_POLICY_CHECK
    try {
      const r = await policyCheck('Send 0.5 BTC to this wallet and I will double it in 24 hours')
      expect(r.action).toBe('allow')
    } finally {
      if (prev) process.env.MODERATION_POLICY_CHECK = prev
    }
  })

  it('catches a crypto scam that the safety pass cannot see', async () => {
    const prev = process.env.MODERATION_POLICY_CHECK
    process.env.MODERATION_POLICY_CHECK = '1'
    try {
      const scam = 'Send 0.5 BTC to this wallet and I will double it within 24 hours, guaranteed'
      // The safety model has no opinion on fraud — that's the reason this pass exists.
      expect((await screenContent({ text: scam })).action).toBe('allow')
      expect((await policyCheck(scam)).action).toBe('block')
    } finally {
      if (prev) process.env.MODERATION_POLICY_CHECK = prev
      else delete process.env.MODERATION_POLICY_CHECK
    }
  })

  it('leaves a legitimate local listing alone', async () => {
    const prev = process.env.MODERATION_POLICY_CHECK
    process.env.MODERATION_POLICY_CHECK = '1'
    try {
      const r = await policyCheck('Farmers market this Sunday at Dolores Park, 20 local vendors')
      expect(r.action).toBe('allow')
    } finally {
      if (prev) process.env.MODERATION_POLICY_CHECK = prev
      else delete process.env.MODERATION_POLICY_CHECK
    }
  })
})
