import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import {
  getVendorSettings,
  upsertVendorSettings,
  getBusinessKnowledge,
  addBusinessKnowledge,
  deleteBusinessKnowledge,
} from '@/lib/vendor-connect'
import type OpenAI from 'openai'

export const runtime = 'nodejs'

// Conversational agent tuner. The owner talks (type or, via /voice, speak) and
// this loop refines their customer-service agent: tone/persona, FAQ notes, and
// on/off. Same brain for chat and voice — the voice client sends its transcript
// here to apply the changes it discussed.

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'update_tone',
      description:
        "Replace the agent's tone/persona instructions. Pass the FULL new tone text (merge the owner's request into the existing tone, don't just append).",
      parameters: {
        type: 'object',
        properties: { persona: { type: 'string', description: 'The complete new tone/persona instructions.' } },
        required: ['persona'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Add a custom fact/FAQ the agent should know (parking, returns, allergens, etc.).',
      parameters: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_note',
      description: 'Remove a custom note by its id (ids are listed in the current config).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_enabled',
      description: 'Turn the public customer-service agent on or off.',
      parameters: {
        type: 'object',
        properties: { enabled: { type: 'boolean' } },
        required: ['enabled'],
      },
    },
  },
]

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId ?? null)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const memberId = actor.memberId
  const fromVoice = Boolean(body.fromVoice)
  const incoming = Array.isArray(body.messages) ? body.messages : []

  const [settings, knowledge] = await Promise.all([
    getVendorSettings(memberId),
    getBusinessKnowledge(memberId),
  ])
  let persona = settings?.assistant_persona ?? ''
  let enabled = settings?.assistant_enabled !== false

  const noteList = knowledge.map((k) => `- [${k.id}] ${k.content}`).join('\n') || '(none yet)'
  const system = `You help a small-business owner refine their customer-service AI agent through conversation. You can change the agent's TONE/persona, ADD or REMOVE FAQ notes, and turn it on/off — using the provided tools.

Current agent config:
- Enabled: ${enabled}
- Tone/persona: ${persona ? `"${persona}"` : '(default — friendly & helpful)'}
- Notes:\n${noteList}

Guidance:
- When the owner's intent is clear, make the change with a tool, then briefly tell them exactly what you changed.
- If a request is ambiguous or broad (e.g. "make it less aggressive"), briefly say how you'll interpret it (1–2 concrete changes), and unless they object, apply it — offer to fine-tune further.
- For tone changes, always pass the COMPLETE new tone text to update_tone (merge, don't clobber unrelated instructions).
- Keep replies short and conversational. ${fromVoice ? 'This is a transcript of a VOICE conversation — apply the changes the owner agreed to, then give a one-line summary.' : ''}`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...incoming.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ]

  const openai = getOpenAI()
  const changes: string[] = []
  let reply = ''

  try {
    for (let step = 0; step < 5; step++) {
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
          /* bad args → skip */
        }
        let result = 'ok'
        // Demo actors preview the conversation but don't persist changes.
        const canWrite = !actor.isDemo
        switch (tc.function.name) {
          case 'update_tone': {
            persona = String(args.persona ?? '')
            if (canWrite) await upsertVendorSettings(memberId, { assistant_persona: persona })
            changes.push('Updated tone & style')
            result = 'tone updated'
            break
          }
          case 'add_note': {
            const content = String(args.content ?? '').trim()
            if (content) {
              if (canWrite) await addBusinessKnowledge(memberId, content.slice(0, 4000))
              changes.push(`Added note: “${content.slice(0, 60)}${content.length > 60 ? '…' : ''}”`)
              result = 'note added'
            } else result = 'empty note, skipped'
            break
          }
          case 'remove_note': {
            const id = String(args.id ?? '')
            if (id) {
              if (canWrite) await deleteBusinessKnowledge(id, memberId)
              changes.push('Removed a note')
              result = 'note removed'
            }
            break
          }
          case 'set_enabled': {
            enabled = Boolean(args.enabled)
            if (canWrite) await upsertVendorSettings(memberId, { assistant_enabled: enabled })
            changes.push(enabled ? 'Turned the agent ON' : 'Turned the agent OFF')
            result = 'enabled set'
            break
          }
          default:
            result = 'unknown tool'
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }
    }
  } catch (e) {
    console.error('[assistant/tune] error', e)
    return NextResponse.json({ error: 'tune_failed' }, { status: 502 })
  }

  // Reload the persisted config so the UI reflects reality (in demo it's the
  // in-memory preview values).
  const [freshSettings, freshKnowledge] = actor.isDemo
    ? [{ assistant_enabled: enabled, assistant_persona: persona }, knowledge]
    : await Promise.all([getVendorSettings(memberId), getBusinessKnowledge(memberId)])

  return NextResponse.json({
    reply: reply || (changes.length ? `Done — ${changes.join('; ')}.` : "Okay — tell me what you'd like to change."),
    changes,
    config: {
      enabled: freshSettings?.assistant_enabled !== false,
      persona: freshSettings?.assistant_persona ?? '',
      knowledge: freshKnowledge,
    },
  })
}
