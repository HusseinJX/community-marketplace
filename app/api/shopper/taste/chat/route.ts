// "Tell it what you're into" — a conversation that edits your own profile.
//
// The same shape as the vendor agent tuner (/api/vendor/assistant/tune): a
// short tool loop where the model makes the change and then says what it
// changed. What it writes is the SAME `about` paragraph and chip set the person
// can see and edit by hand on /shopper — deliberately, so the profile is never
// a thing the machine knows about you that you cannot read or correct.
//
// It never embeds the transcript. An ever-growing conversation embedded raw
// drifts, weights whatever was said most, and cannot be edited by the person it
// describes. A short paragraph they can rewrite can.

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rateLimit } from '@/lib/rate-limit'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { subjectFor, getTaste, saveTaste, clearTaste, tasteConfigured } from '@/lib/reco/taste'
import { INTERESTS } from '@/lib/reco/profile'
import type OpenAI from 'openai'

export const runtime = 'nodejs'

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'set_about',
      description:
        'Replace the free-text description of what this person is into. Pass the FULL new text, merging their latest message into what is already there — do not just append, and do not drop details they gave earlier unless they asked you to.',
      parameters: {
        type: 'object',
        properties: {
          about: {
            type: 'string',
            description:
              'A short paragraph in plain language, written about them ("Has a 4-year-old, no car, prefers free things"). 2-4 sentences maximum.',
          },
        },
        required: ['about'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_interests',
      description:
        'Replace the set of interest chips. Pass the FULL list you want them to end up with, not just additions.',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string', enum: INTERESTS.map((i) => i.id) },
            description: 'Interest ids to keep.',
          },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget_everything',
      description:
        'Delete the whole stored profile. Only when they clearly ask to be forgotten or to start over.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { userId } = await auth().catch(() => ({ userId: null }) as { userId: string | null })
  const subject = subjectFor(userId ?? null, body.id)
  if (!subject) return NextResponse.json({ error: 'No profile id' }, { status: 400 })

  const limited = rateLimit({ req, name: 'taste-chat', id: subject, limit: 20, windowMs: 60_000 })
  if (limited) return limited

  if (!process.env.OPENAI_API_KEY || !tasteConfigured()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const incoming = Array.isArray(body.messages) ? body.messages : []
  if (!incoming.length) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const current = await getTaste(subject).catch(() => null)
  const chipList = INTERESTS.map((i) => `${i.id} (${i.label})`).join(', ')

  const system = `You help someone describe what they enjoy, so a local events feed can find things they'd actually want to go to. You are editing THEIR OWN profile, which they can see and edit by hand.

Their profile right now:
- Interests: ${current?.interests.length ? current.interests.join(', ') : '(none picked)'}
- In their words: ${current?.about ? `"${current.about}"` : '(nothing yet)'}

Available interest ids: ${chipList}

How to behave:
- When what they want is clear, make the change with a tool, then say in one short sentence what you saved.
- Keep the "about" text in plain language and SHORT (2-4 sentences). Include practical constraints they mention — kids and their ages, no car, budget, evenings only, mobility, language — these matter more for matching than tastes do.
- Write only what they actually told you or clearly implied. Do not invent details to make the profile fuller, and do not guess at anything sensitive they did not volunteer.
- If they say something that contradicts what is stored, replace it rather than keeping both.
- If they just ask a question, answer it briefly and change nothing.
- Be warm and brief. Never lecture, never list their profile back at them unless they ask.`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...(incoming.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 2000),
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
  ]

  const openai = getOpenAI()
  const changes: string[] = []
  let reply = ''

  try {
    for (let step = 0; step < 4; step++) {
      const resp = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      })
      const msg = resp.choices[0]?.message
      if (!msg) break
      messages.push(msg)

      if (!msg.tool_calls?.length) {
        reply = msg.content ?? ''
        break
      }

      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          /* bad args → skip the call rather than write a guess */
        }
        let result = 'ok'
        switch (tc.function.name) {
          case 'set_about': {
            const about = String(args.about ?? '').trim()
            if (about) {
              await saveTaste(subject, { about })
              changes.push('Updated what you’re into')
              result = 'saved'
            } else result = 'empty, skipped'
            break
          }
          case 'set_interests': {
            const ids = Array.isArray(args.ids) ? args.ids.map(String) : []
            await saveTaste(subject, { interests: ids })
            changes.push(ids.length ? `Interests: ${ids.join(', ')}` : 'Cleared your interests')
            result = 'saved'
            break
          }
          case 'forget_everything': {
            await clearTaste(subject)
            changes.push('Deleted your profile')
            result = 'deleted'
            break
          }
          default:
            result = 'unknown tool'
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }
    }
  } catch (e) {
    console.error('[shopper/taste/chat] error', e)
    return NextResponse.json({ error: 'chat_failed' }, { status: 502 })
  }

  // Reload so the UI shows what was actually stored, not what the model said it
  // stored — the two can differ, and the person is entitled to see the truth.
  const taste = await getTaste(subject).catch(() => null)

  return NextResponse.json({
    reply:
      reply ||
      (changes.length ? `Saved — ${changes.join('; ')}.` : 'Tell me what kind of thing you enjoy.'),
    changes,
    taste,
  })
}
