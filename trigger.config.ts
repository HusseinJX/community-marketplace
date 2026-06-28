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
