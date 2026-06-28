import { getOpenAI, CHAT_MODEL } from "./openai";
import { LIVE_EVENTS } from "./live-events";

// Parse a venue's free-text message ("we're showing the world cup final at 5pm,
// going for Mexico") into a structured broadcast. Used by the connector ingest
// endpoint so a venue can go live by text instead of the portal.

export interface ParsedBroadcast {
  event_slug: string;
  whats_on: string | null;
  supports_team: string | null;
  note: string | null;
  duration_minutes: number | null;
  starts_at: string | null; // ISO; null = now
}

const SLUGS = LIVE_EVENTS.map((e) => e.slug);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["event_slug", "whats_on", "supports_team", "note", "duration_minutes", "starts_at"],
  properties: {
    event_slug: { type: "string", enum: SLUGS, description: "Closest matching event type; use 'other' if none fit." },
    whats_on: { type: ["string", "null"], description: "The specific matchup/game, e.g. 'Lakers vs Celtics'." },
    supports_team: { type: ["string", "null"], description: "The team/country the venue is rooting for, if stated." },
    note: { type: ["string", "null"], description: "Short vibe note if mentioned (specials, big screen, etc.)." },
    duration_minutes: { type: ["integer", "null"], description: "How long it runs, in minutes, if stated." },
    starts_at: { type: ["string", "null"], description: "ISO 8601 start time if a future time is stated; null means start now." },
  },
};

export async function parseBroadcastText(text: string, nowIso: string = new Date().toISOString()): Promise<ParsedBroadcast | null> {
  const eventList = LIVE_EVENTS.map((e) => `${e.slug} (${e.label})`).join(", ");
  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You convert a venue's short message into a structured live-sports broadcast. " +
          `Current time is ${nowIso}. Valid event types: ${eventList}. ` +
          "Map the message to the closest event_slug. If the message names a future time, return starts_at as an absolute ISO 8601 timestamp; otherwise return null (it starts now). " +
          "Do not invent a matchup or team that isn't implied. Keep note short.",
      },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "parsed_broadcast", schema: SCHEMA, strict: true },
    },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as ParsedBroadcast;
    if (!parsed.event_slug) return null;
    return parsed;
  } catch {
    return null;
  }
}
