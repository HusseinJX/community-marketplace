import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getVendorSettings, getBusinessKnowledge } from '@/lib/vendor-connect'

export const runtime = 'nodejs'

// Mints a short-lived OpenAI Realtime session for TUNING the customer-service
// agent by voice. The owner talks; the session helps them refine tone/notes,
// confirming changes out loud. The conversation transcript is sent (client-side,
// on hang-up) to /api/vendor/assistant/tune to actually persist the changes —
// same pattern as the /join voice interview. Grounded in the current config so
// it can reference what's already set.

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini'
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId ?? null)
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'voice_unavailable' }, { status: 503 })
  }

  const [settings, knowledge] = await Promise.all([
    getVendorSettings(actor.memberId),
    getBusinessKnowledge(actor.memberId),
  ])
  const persona = settings?.assistant_persona || '(default — friendly & helpful)'
  const notes = knowledge.map((k) => `• ${k.content}`).join('\n') || '(none yet)'

  const instructions = `You are helping a small-business owner fine-tune their customer-service AI agent — the assistant that answers their customers on their profile. Talk with them naturally, like a helpful producer dialing in a voice.

The agent's CURRENT setup:
- Tone/persona: ${persona}
- Notes it knows:\n${notes}

How to run the conversation:
- Greet briefly and ask what they'd like to change about their agent.
- When they ask for something (e.g. "make it less aggressive"), say how you'll interpret it in 1–2 concrete changes, and ask if that's right or if they want to adjust.
- Let them refine — e.g. "keep it firm about refunds but warmer otherwise." Reflect it back.
- Before wrapping up, clearly RESTATE the final agreed changes in one or two sentences (tone changes and any notes to add/remove), so they can be applied.
- Keep turns short and conversational. Don't read long lists aloud.`

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions,
          audio: {
            output: { voice: REALTIME_VOICE },
            input: { transcription: { model: 'whisper-1' } },
          },
        },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[assistant/voice] realtime mint failed', res.status, detail)
      return NextResponse.json({ error: 'session_failed' }, { status: 502 })
    }
    const session = await res.json()
    const clientSecret = session?.value
    if (!clientSecret) return NextResponse.json({ error: 'session_failed' }, { status: 502 })
    return NextResponse.json({ client_secret: clientSecret, model: REALTIME_MODEL })
  } catch (e) {
    console.error('[assistant/voice] realtime error', e)
    return NextResponse.json({ error: 'session_failed' }, { status: 502 })
  }
}
