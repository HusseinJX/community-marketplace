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

const api = async (path) => {
  const res = await fetch(`https://sentry.io/api/0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

// One call: every project the token can see, each carrying its organization.
const projects = await api('/projects/')
const hit = projects.find((p) => String(p.id) === projectId)

if (!hit) {
  console.error(
    `Token is valid but cannot see project ${projectId}. ` +
      `Visible: ${projects.map((p) => `${p.slug}(${p.id})`).join(', ') || 'none'}`,
  )
  process.exit(1)
}

const org = hit.organization.slug
const project = hit.slug

const written = raw
  .replace(/^SENTRY_ORG=.*$/m, `SENTRY_ORG=${org}`)
  .replace(/^SENTRY_PROJECT=.*$/m, `SENTRY_PROJECT=${project}`)

fs.writeFileSync(ENV, written)
console.log(`SENTRY_ORG=${org}`)
console.log(`SENTRY_PROJECT=${project}`)
console.log('written to .env.local — now run: npm run build')
