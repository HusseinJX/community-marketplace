import { defineConfig } from '@trigger.dev/sdk'

// Trigger.dev project for the community-marketplace app.
//
// ⚠️ Set `project` to this repo's own project ref from `npx trigger.dev init`
// (or the Trigger.dev dashboard → Project settings). It is intentionally read
// from TRIGGER_PROJECT_REF so the ref isn't hardcoded across environments;
// `trigger.dev init` will also write it here if you let it.
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF || 'proj_REPLACE_ME',
  dirs: ['./trigger'],
  // Node 22, not the default 21. `@supabase/supabase-js` builds a Realtime
  // client eagerly inside createClient(), and Realtime throws on any runtime
  // without a native WebSocket — which Node 21 is. Every deployed run died at
  // the first Supabase call while local runs (Node 25) passed, so the failure
  // was invisible outside the deployed environment.
  runtime: 'node-22',
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      randomize: true,
    },
  },
})
