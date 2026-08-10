// Fill SENTRY_ORG / SENTRY_PROJECT in .env.local from SENTRY_AUTH_TOKEN.
//
// Source-map upload needs the org and project SLUGS ("whatslocal", "javascript-nextjs"),
// but the DSN only carries their numeric IDs — so they cannot be derived from what we
// already have. This asks Sentry, using the one thing you have to create by hand.
//
//   1. sentry.io → Settings → Auth Tokens → Create Auth Token (org token, `sntrys_…`)
//   2. put it in .env.local as SENTRY_AUTH_TOKEN=…
//   3. node scripts/sentry-fill-slugs.mjs
//
// Matches the project by the numeric id already in SENTRY_DSN, so it picks the right one
// even if the account has several.

import fs from 'node:fs'

const ENV = '.env.local'
const raw = fs.readFileSync(ENV, 'utf8')

const read = (key) => {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

const token = read('SENTRY_AUTH_TOKEN')
const dsn = read('SENTRY_DSN') || read('NEXT_PUBLIC_SENTRY_DSN')

if (!token) {
  console.error('SENTRY_AUTH_TOKEN is empty in .env.local — create one at sentry.io → Settings → Auth Tokens')
  process.exit(1)
}

const projectId = (dsn.match(/@[^/]+\/(\d+)/) || [])[1]
if (!projectId) {
  console.error('Could not read the project id out of SENTRY_DSN')
  process.exit(1)
}

// An ORG auth token (`sntrys_…`) carries its own org and REGION in a base64
// payload. Both matter: the org saves a lookup, and the region is why a plain
// `sentry.io/api/0/projects/` call 403s — a US-region token has to talk to
// us.sentry.io, and the wrong host reads as a permissions error rather than a
// routing one.
const claims = (() => {
  if (!token.startsWith('sntrys_')) return {}
  try {
    let b = token.split('_')[1]
    b += '='.repeat((4 - (b.length % 4)) % 4)
    return JSON.parse(Buffer.from(b, 'base64').toString('utf8'))
  } catch {
    return {}
  }
})()

const base = (claims.region_url || 'https://sentry.io').replace(/\/$/, '')

const api = async (path) => {
  const res = await fetch(`${base}/api/0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`${base}${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

const org = claims.org
if (!org) {
  console.error('Token has no embedded org — use an ORGANIZATION auth token (sntrys_…), not a personal one')
  process.exit(1)
}

// Listing projects needs `project:read`, which an upload token does NOT have —
// the scope it needs for its actual job is `project:releases`. So try the clean
// way, then fall back to asking the releases endpoint (which the token IS
// entitled to) whether a candidate slug exists: 200 = right, 404 = wrong.
async function findProjectSlug() {
  try {
    const projects = await api(`/organizations/${org}/projects/`)
    const hit = projects.find((p) => String(p.id) === projectId)
    if (hit) return hit.slug
    console.error(`Token sees org "${org}" but not project ${projectId}.`)
    process.exit(1)
  } catch (e) {
    if (!String(e.message).includes('403')) throw e
  }

  // The org slug first — Sentry names the first project after the org more often
  // than not, and the wizard's default is second.
  const candidates = [org, 'javascript-nextjs', `${org}-web`, 'nextjs', 'javascript']
  for (const slug of candidates) {
    try {
      await api(`/projects/${org}/${slug}/releases/`)
      console.log(`(listing was 403 — found "${slug}" by probing releases)`)
      return slug
    } catch {
      /* 404 = not this one */
    }
  }
  console.error(
    `Could not determine the project slug. Either add project:read to the token, ` +
      `or read it off your Sentry URL: sentry.io/organizations/${org}/projects/<SLUG>/`,
  )
  process.exit(1)
}

const project = await findProjectSlug()

const written = raw
  .replace(/^SENTRY_ORG=.*$/m, `SENTRY_ORG=${org}`)
  .replace(/^SENTRY_PROJECT=.*$/m, `SENTRY_PROJECT=${project}`)

fs.writeFileSync(ENV, written)
console.log(`SENTRY_ORG=${org}`)
console.log(`SENTRY_PROJECT=${project}`)
console.log('written to .env.local — now run: npm run build')
