import OpenAI from 'openai'

// Lazily-instantiated server-side OpenAI client. Lazy because the v6 constructor
// throws when the key is absent, which would break `next build` page-data
// collection (the key isn't present at build time). Never import into a client
// component — the key must stay server-side.
let _client: OpenAI | null = null
export function getOpenAI(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

// Text/vision chat model. Overridable per-env so we can bump without code changes.
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

// Vision model for image extraction (Phase 2). Same family, higher fidelity default.
export const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o'

// Image generation model for product-image refinement (Phase 2).
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
