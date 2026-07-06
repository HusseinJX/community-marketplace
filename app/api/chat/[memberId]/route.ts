import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { buildBusinessContext, buildSystemPrompt } from '@/lib/business-context'
import { getEntitlements } from '@/lib/entitlements'
import {
  createConversation,
  appendMessages,
  createLead,
  getOrderByNumber,
} from '@/lib/vendor-connect'
import type OpenAI from 'openai'

export const runtime = 'nodejs'

// Tools the assistant can call. Kept small for Phase 1 (read-only Q&A + lead
// capture); the voice phase will graduate these to real actions.
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'capture_lead',
      description:
        "Record the customer's contact details so the business can follow up. Use when you cannot answer a question or the customer wants to be contacted.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer name, if given' },
          contact: { type: 'string', description: 'Phone or email to reach the customer' },
          message: { type: 'string', description: 'What the customer wants' },
        },
        required: ['contact', 'message'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_order_status',
      description: 'Look up the status of an existing order by its order number.',
      parameters: {
        type: 'object',
        properties: {
          order_number: { type: 'string', description: 'The order number, e.g. WL-12AB34' },
        },
        required: ['order_number'],
        additionalProperties: false,
      },
    },
  },
]

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { memberId: string; conversationId: string }
): Promise<unknown> {
  if (name === 'capture_lead') {
    await createLead({
      memberId: ctx.memberId,
      conversationId: ctx.conversationId,
      name: (args.name as string) ?? null,
      contact: (args.contact as string) ?? null,
      message: (args.message as string) ?? null,
    })
    return { ok: true, note: 'The business has been notified and will follow up.' }
  }
  if (name === 'check_order_status') {
    const order = await getOrderByNumber(String(args.order_number ?? ''), ctx.memberId)
    if (!order) return { found: false }
    return {
      found: true,
      order_number: order.order_number,
      status: order.status,
      items: order.items?.map((i) => ({ name: i.name, qty: i.qty })) ?? [],
      tracking_url: order.uber_tracking_url ?? undefined,
    }
  }
  return { error: `Unknown tool: ${name}` }
}

type ClientMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request, ctx: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await ctx.params

  let body: { messages?: ClientMessage[]; conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return new Response('Last message must be from the user', { status: 400 })
  }

  // The text agent is a Member+ capability — free/unclaimed listings don't have it.
  const ent = await getEntitlements(memberId)
  if (!ent.can.textAssistant) {
    return new Response('Assistant not available for this business', { status: 402 })
  }

  const context = await buildBusinessContext(memberId)
  if (!context.assistantEnabled) {
    return new Response('Assistant disabled for this business', { status: 403 })
  }

  const conversationId = body.conversationId || (await createConversation(memberId))
  const latestUser = history[history.length - 1]

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let finalText = ''
      try {
        // Tool loop: stream content tokens to the client; if the model calls a
        // tool, run it server-side and continue until it produces a final reply.
        for (let turn = 0; turn < 4; turn++) {
          const completion = await getOpenAI().chat.completions.create({
            model: CHAT_MODEL,
            messages,
            tools,
            stream: true,
            temperature: 0.4,
          })

          let content = ''
          let finishReason: string | null = null
          const toolCalls: Record<number, { id: string; name: string; args: string }> = {}

          for await (const chunk of completion) {
            const choice = chunk.choices[0]
            const delta = choice?.delta
            if (delta?.content) {
              content += delta.content
              controller.enqueue(encoder.encode(delta.content))
            }
            for (const tc of delta?.tool_calls ?? []) {
              const slot = (toolCalls[tc.index] ??= { id: '', name: '', args: '' })
              if (tc.id) slot.id = tc.id
              if (tc.function?.name) slot.name += tc.function.name
              if (tc.function?.arguments) slot.args += tc.function.arguments
            }
            if (choice?.finish_reason) finishReason = choice.finish_reason
          }

          if (finishReason === 'tool_calls') {
            const calls = Object.values(toolCalls)
            messages.push({
              role: 'assistant',
              content: content || null,
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: c.args },
              })),
            })
            for (const c of calls) {
              let parsed: Record<string, unknown> = {}
              try {
                parsed = c.args ? JSON.parse(c.args) : {}
              } catch {
                /* ignore malformed args */
              }
              const result = await runTool(c.name, parsed, { memberId, conversationId })
              messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) })
            }
            continue // model will now produce its final answer
          }

          finalText = content
          break
        }
      } catch (err) {
        console.error('Chat stream error:', err)
        controller.enqueue(encoder.encode('\n\nSorry — something went wrong. Please try again.'))
      } finally {
        // Persist the exchange (best-effort) for the owner inbox + analytics.
        appendMessages(conversationId, memberId, [
          { role: 'user', content: latestUser.content },
          ...(finalText ? [{ role: 'assistant', content: finalText }] : []),
        ]).catch((e) => console.error('Persist chat failed:', e))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Conversation-Id': conversationId,
    },
  })
}
