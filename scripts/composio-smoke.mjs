// One-off smoke test: verifies COMPOSIO_API_KEY authenticates and the Shopify
// auth config resolves. Loads .env.local manually (no dep). Safe/read-only.
import { readFileSync } from 'node:fs'
import { Composio, AuthScheme } from '@composio/core'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY })

console.log('API key prefix:', (process.env.COMPOSIO_API_KEY || '').slice(0, 6) + '…')
console.log('Shopify auth config:', process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID)

try {
  const ac = await composio.authConfigs.get(process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID)
  console.log('\n✅ Auth config resolved:')
  console.log('   toolkit:', ac?.toolkit?.slug ?? ac?.toolkit ?? '(unknown)')
  console.log('   id:', ac?.id ?? ac?.nanoid ?? '(unknown)')
  console.log('   authScheme:', ac?.authScheme ?? ac?.type ?? '(unknown)')
} catch (e) {
  console.error('\n❌ Auth config fetch failed:', e?.message || e)
  process.exit(1)
}

// Exercise the exact connect path: initiate an OAuth connection for a throwaway
// member id and confirm Composio returns an authorization redirect URL.
// Opt-in (creates a real pending connection): `node scripts/composio-smoke.mjs --initiate`
if (!process.argv.includes('--initiate')) {
  console.log('\n(skip connection initiate — pass --initiate to test it)')
  process.exit(0)
}
try {
  const conn = await composio.connectedAccounts.initiate(
    'smoke-test-member',
    process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID,
    {
      callbackUrl: `${process.env.MARKETPLACE_URL}/vendor/integrations?connected=shopify`,
      config: AuthScheme.OAuth2({ subdomain: 'whatslocal-test-store' }),
    }
  )
  console.log('\n✅ Connection initiated:')
  console.log('   connectionId:', conn?.id)
  console.log('   redirectUrl:', conn?.redirectUrl)
} catch (e) {
  console.error('\n❌ Connection initiate failed:', e?.message || e)
  process.exit(1)
}
