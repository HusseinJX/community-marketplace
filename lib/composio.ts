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

// Toolkit versions are PINNED, and they have to be: tools.execute() throws
// ComposioToolVersionRequiredError when the resolved version is "latest", so
// without these every runTool() call fails — catalog sync and order push-back
// alike. Pinning is also what stops a Composio release silently changing an
// argument name underneath a nightly sync.
//
// Bump deliberately after checking the tool schema still matches:
//   composio.tools.getRawComposioToolBySlug('SQUARE_SEARCH_CATALOG_OBJECTS')
//     → .version, .availableVersions
// Env vars allow a hotfix without a deploy.
const TOOLKIT_VERSIONS: Record<string, string> = {
  square: process.env.COMPOSIO_SQUARE_TOOLKIT_VERSION || '20260721_00',
  shopify: process.env.COMPOSIO_SHOPIFY_TOOLKIT_VERSION || '20260807_00',
}

export function getComposio(): Composio {
  if (!composio) {
    const apiKey = process.env.COMPOSIO_API_KEY
    if (!apiKey) throw new Error('COMPOSIO_API_KEY is required')
    composio = new Composio({ apiKey, toolkitVersions: TOOLKIT_VERSIONS })
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

// Composio's tool slugs per platform.
//
// ⚠️ VERIFY A SLUG AGAINST THE LIVE TOOLKIT BEFORE TRUSTING IT — an invented one
// fails at call time with "Unable to retrieve tool with slug X", which in a
// fire-and-forget path (order push-back) is a log line nobody reads.
// `SQUARE_LIST_CATALOG` was wrong from the start and catalog sync could never
// have worked; it was invisible because no vendor had connected yet. Check with:
//   composio.tools.getRawComposioToolBySlug('SQUARE_SEARCH_CATALOG_OBJECTS')
// and confirm argument names the same way — they are the provider's, not ours.
export const TOOL_SLUGS = {
  // SHOPIFY_LIST_ALL_PRODUCTS was invented too — same bug, same invisibility.
  // The paginated variant is the one to use: SHOPIFY_GET_PRODUCTS also exists but
  // is deprecated and says outright that it "may return only a partial set".
  shopify: { list: 'SHOPIFY_GET_PRODUCTS_PAGINATED', createOrder: 'SHOPIFY_CREATE_ORDER' },
  square: { list: 'SQUARE_SEARCH_CATALOG_OBJECTS', createOrder: 'SQUARE_CREATE_ORDER' },
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
