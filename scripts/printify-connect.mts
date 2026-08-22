/**
 * Connect a Printify account to a marketplace vendor, and see what it holds.
 *
 * Read-only by default: it lists the shops and the catalogue and prints what a
 * sync WOULD import. Pass --save to store the credentials in vendor_secrets,
 * and --sync to import the catalogue as drafts.
 *
 *   npx tsx scripts/printify-connect.mts <memberId> --token-from <path/to/.env>
 *   npx tsx scripts/printify-connect.mts <memberId> --token-from <.env> --save --sync
 *
 * The token is read from a .env file rather than the command line so it never
 * lands in shell history.
 */
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

const [memberId] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const argv = process.argv.slice(2)
const envPath = argv[argv.indexOf('--token-from') + 1]
const doSave = argv.includes('--save')
const doSync = argv.includes('--sync')

if (!memberId || !envPath) {
  console.error('usage: printify-connect.mts <memberId> --token-from <envfile> [--save] [--sync]')
  process.exit(1)
}

function fromEnvFile(path: string, key: string): string {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

const token = fromEnvFile(envPath, 'PRINTIFY_API_TOKEN')
const shopIdFromEnv = fromEnvFile(envPath, 'PRINTIFY_SHOP_ID')
if (!token) {
  console.error(`No PRINTIFY_API_TOKEN in ${envPath}`)
  process.exit(1)
}
console.log(`token: ${token.length} chars · shop from env: ${shopIdFromEnv || '(none)'}`)

const { listShops, listProducts, savePrintifyCreds } = await import('../lib/printify.ts')

const shops = await listShops(token)
console.log(`\nshops (${shops.length}):`)
for (const s of shops) console.log(`  ${s.id}  ${s.title}  [${s.salesChannel ?? '—'}]`)

const shopId = shopIdFromEnv || String(shops[0]?.id ?? '')
if (!shopId) { console.error('No shop to use.'); process.exit(1) }

const products = await listProducts(token, shopId, 50)
console.log(`\ncatalogue in shop ${shopId} (${products.length}):`)
for (const p of products) {
  const enabled = p.variants.filter((v) => v.enabled)
  console.log(`  ${p.title}`)
  console.log(`    id=${p.productId} variants=${p.variants.length} enabled=${enabled.length} image=${p.imageUrl ? 'yes' : 'no'}`)
  for (const v of enabled.slice(0, 4)) {
    console.log(`      · ${v.title} — $${(v.priceCents / 100).toFixed(2)} (variant ${v.variantId})`)
  }
  if (enabled.length > 4) console.log(`      … ${enabled.length - 4} more enabled variants`)
}

if (doSave) {
  await savePrintifyCreds(memberId, { token, shopId })
  console.log(`\nSAVED credentials for member ${memberId}`)
}

if (doSync) {
  const { syncPrintifyCatalog } = await import('../lib/printify-commerce.ts')
  const res = await syncPrintifyCatalog(memberId, 'Xeno')
  console.log(`SYNCED: imported ${res.imported} · updated ${res.updated} · skipped ${res.skipped}`)
}
