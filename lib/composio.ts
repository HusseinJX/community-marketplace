import { Composio } from '@composio/core'

// Single Composio client for the marketplace. Auth-config ids are created once
// per platform in the Composio dashboard (Auth Configs → New) and supplied via
// env. Every connection and tool call is scoped by `userId = marketplace
// memberId`, so a vendor's connected store is always resolvable from their
// member id without storing a separate Composio handle.
//
// Ported from the connector-agent (lib/composio.js) — this app now owns the
// Composio integration natively rather than proxying to the connector.
let composio: Composio | null = null

export function getComposio(): Composio {
  if (!composio) {
    const apiKey = process.env.COMPOSIO_API_KEY
    if (!apiKey) throw new Error('COMPOSIO_API_KEY is required')
    composio = new Composio({ apiKey })
  }
  return composio
}

export type ComposioPlatform = 'shopify' | 'square'

const AUTH_CONFIG_ENV: Record<ComposioPlatform, string> = {
  shopify: 'COMPOSIO_SHOPIFY_AUTH_CONFIG_ID',
  square: 'COMPOSIO_SQUARE_AUTH_CONFIG_ID',
}

export const SUPPORTED_PLATFORMS = Object.keys(AUTH_CONFIG_ENV) as ComposioPlatform[]

export function isSupportedPlatform(p: string): p is ComposioPlatform {
  return (SUPPORTED_PLATFORMS as string[]).includes(p)
}

export function authConfigIdFor(platform: ComposioPlatform): string {
  const envKey = AUTH_CONFIG_ENV[platform]
  const id = envKey && process.env[envKey]
  if (!id) {
    throw new Error(`No Composio auth config id configured for platform "${platform}" (set ${envKey})`)
  }
  return id
}

// Composio's tool slugs per platform. Confirm exact argument/return schemas in
// the dashboard (Auth Configs → Tools & Triggers) before relying on a field.
export const TOOL_SLUGS = {
  shopify: { list: 'SHOPIFY_LIST_ALL_PRODUCTS', createOrder: 'SHOPIFY_CREATE_ORDER' },
  square: { list: 'SQUARE_LIST_CATALOG', createOrder: 'SQUARE_CREATE_ORDER' },
} as const

// composio.tools.execute returns { data, successful, error } across recent SDK
// versions. Normalize to throw on failure and return the raw provider payload.
export async function runTool(
  slug: string,
  memberId: string,
  args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const result = await getComposio().tools.execute(slug, { userId: memberId, arguments: args })
  if (result && (result as { successful?: boolean }).successful === false) {
    const err = (result as { error?: string }).error || 'unknown error'
    throw new Error(`Composio ${slug} failed: ${err}`)
  }
  const data = (result as { data?: Record<string, unknown> })?.data
  return (data ?? result) as Record<string, unknown>
}
