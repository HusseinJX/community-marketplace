import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { PROFILE_SCHEMA, EXTRACT_INSTRUCTION, type ExtractedProfile } from '@/lib/onboard'
import { isDemoMode } from '@/lib/demo-admin'

export const runtime = 'nodejs'

// POST { text } — extract a structured member profile from interview notes or an
// onboarding chat transcript. Any signed-in user (demo allowed); no DB write.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const text = String(body.text ?? '').trim()
  if (text.length < 10) {
    return NextResponse.json({ error: 'Add more about the business first' }, { status: 400 })
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: EXTRACT_INSTRUCTION },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'member_profile', schema: PROFILE_SCHEMA, strict: true },
      },
    })
    const profile = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as ExtractedProfile
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ error: 'Could not read that — try rephrasing' }, { status: 502 })
  }
}
