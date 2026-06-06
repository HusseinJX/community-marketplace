import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: 120_000, // real OpenAI / image-gen calls are slow
    hookTimeout: 60_000,
    // integration tests share live data — run serially to avoid cross-talk
    fileParallelism: false,
  },
})
