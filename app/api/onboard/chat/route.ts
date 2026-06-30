import { NextResponse } from 'next/server'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { onboardingSystemPrompt } from '@/lib/onboard'

export const runtime = 'nodejs'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

// POST { messages, eventName? } — one turn of the onboarding conversation.
// Public (the person hasn't signed in yet); creation later requires sign-in.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-20) : []
  const eventName = body.eventName ? String(body.eventName) : undefined

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: onboardingSystemPrompt(eventName) },
        ...messages.map((m) => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: String(m.content ?? ''),
        })),
      ],
    })
    const reply = completion.choices[0]?.message?.content ?? "Tell me a bit about your business!"
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: "Sorry — say that again? Tell me about your business." })
  }
}
