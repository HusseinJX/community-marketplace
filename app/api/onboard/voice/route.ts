import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { interviewVoicePrompt } from '@/lib/onboard'
import { isDemoMode } from '@/lib/demo-admin'
import { isJoinDemoActive } from '@/lib/joindemo'

export const runtime = 'nodejs'

// Mints a short-lived OpenAI Realtime session for the in-browser ONBOARDING
// interview — the voice-over-internet version of the /onboard chat. Same WebRTC
// plumbing as the business voice agent (/api/chat/[memberId]/voice) but the
// session is a generic *interviewer* that gathers the new member's profile.
//
// Not entitlement-gated: the person is mid-join and not yet on a paid plan. It's
// bounded instead by (a) requiring a signed-in Clerk session and (b) the client's
// hard call-length cap in VoiceCall. The real OPENAI_API_KEY stays server-side.

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini'
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode() && !(await isJoinDemoActive())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'voice_unavailable' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const name = body.name ? String(body.name).slice(0, 120) : undefined
  const kind = body.kind ? String(body.kind).slice(0, 40) : undefined
  const brief = body.brief ? String(body.brief).slice(0, 2000) : undefined
  const instructions = interviewVoicePrompt({ name, kind, brief })

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
          // Lets the interview actually CONCLUDE. Without a way to hang up, the
          // agent can only stop talking and wait, which is what made the call feel
          // like it wandered on with no destination. The client hangs up when this
          // fires (after the goodbye audio drains) and saves the profile.
          tools: [
            {
              type: 'function',
              name: 'end_call',
              description:
                'End the call. Call this ONLY after you have their wants and offers, said them ' +
                'back, told them you will send recommendations and invites to look out for in ' +
                'the app, and finished saying goodbye out loud. This hangs up and builds their ' +
                'profile.',
              parameters: {
                type: 'object',
                properties: {
                  wants: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                      'What they want FROM the local community, most pressing first, in their own ' +
                      'words. Short concrete phrases, e.g. "live artists to perform on weekends", ' +
                      '"schools to run tortilla workshops with".',
                  },
                  offers: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                      'What they can give TO the community in return — ideally paired to their ' +
                      'wants. Short concrete phrases, e.g. "a room that seats 40", "free masa for ' +
                      'workshops", "an audience of regulars".',
                  },
                },
                required: ['wants', 'offers'],
              },
            },
          ],
          tool_choice: 'auto',
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[onboard/voice] realtime mint failed', res.status, detail)
      return NextResponse.json({ error: 'session_failed' }, { status: 502 })
    }

    const session = await res.json()
    const clientSecret = session?.value
    if (!clientSecret) {
      return NextResponse.json({ error: 'session_failed' }, { status: 502 })
    }

    return NextResponse.json({ client_secret: clientSecret, model: REALTIME_MODEL })
  } catch (e) {
    console.error('[onboard/voice] realtime error', e)
    return NextResponse.json({ error: 'session_failed' }, { status: 502 })
  }
}
