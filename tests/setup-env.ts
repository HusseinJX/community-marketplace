import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Load .env.local into process.env so integration tests hit the real
// OpenAI + Supabase services (these are NOT mocked — they call live APIs).
const envPath = fileURLToPath(new URL('../.env.local', import.meta.url))
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = val
  }
} catch {
  console.warn('Could not load .env.local for integration tests')
}
