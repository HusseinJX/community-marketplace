import { NextResponse } from 'next/server'
import { buildBusinessContext, buildSystemPrompt } from '@/lib/business-context'
import { reserveVoiceCall } from '@/lib/voice-limits'
import { getEntitlements } from '@/lib/entitlements'

export const runtime = 'nodejs'

// Mints a short-lived OpenAI Realtime session so the customer's browser can
// open a WebRTC voice call to this business's AI agent — "call over internet",
// no phone number. The real OPENAI_API_KEY stays server-side; the browser only
// ever receives an ephemeral client secret (expires in ~1 min) that's only good
// for establishing the one call.
//
// The voice agent is grounded in the exact same business context as the text
// assistant (buildBusinessContext + buildSystemPrompt), with a spoken-style
// addendum so it sounds like a receptionist, not a chatbot reading paragraphs.

// Default to the mini realtime model — ~4× cheaper audio; set OPENAI_REALTIME_MODEL
// to gpt-4o-realtime-preview for higher voice quality where cost allows.
const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-mini-realtime-preview'
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy'

const VOICE_STYLE = [
  '',
  '# Voice call',
  'You are on a live phone-style voice call with the customer.',
  '- Speak naturally and warmly, like a helpful receptionist. Keep turns short — a sentence or two.',
  '- Open by greeting them as the business and asking how you can help.',
  '- Never read long lists aloud; summarize and offer to go into detail.',
  '- If you cannot help, offer to take their name and a contact number so the business can follow up.',
].join('\n')

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'voice_unavailable' }, { status: 503 })
  }

  // Voice is a Pro capability. Free/Member businesses don't have a voice agent.
  const ent = await getEntitlements(memberId)
  if (!ent.can.voiceAssistant) {
    return NextResponse.json({ error: 'upgrade_required', plan: ent.plan }, { status: 402 })
  }

  // Enforce the plan's monthly voice quota + a daily safety cap.
  const quota = await reserveVoiceCall(memberId, ent.limits.voiceCallsPerMonth, ent.limits.voiceCallsPerDay)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', reason: quota.reason, usedMonth: quota.usedMonth, monthlyLimit: quota.monthlyLimit },
      { status: 429 }
    )
  }

  const ctx = await buildBusinessContext(memberId)
  const instructions = buildSystemPrompt(ctx) + '\n' + VOICE_STYLE

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        modalities: ['audio', 'text'],
        instructions,
        input_audio_transcription: { model: 'whisper-1' },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[voice] realtime session mint failed', res.status, detail)
      return NextResponse.json({ error: 'session_failed' }, { status: 502 })
    }

    const session = await res.json()
    const clientSecret = session?.client_secret?.value
    if (!clientSecret) {
      return NextResponse.json({ error: 'session_failed' }, { status: 502 })
    }

    return NextResponse.json({
      client_secret: clientSecret,
      model: REALTIME_MODEL,
      businessName: ctx.businessName,
    })
  } catch (e) {
    console.error('[voice] realtime session error', e)
    return NextResponse.json({ error: 'session_failed' }, { status: 502 })
  }
}
