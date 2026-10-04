import { defineConfig } from 'vitest/config'

export default defineConfig({
  configFile: false,
  root: process.cwd(),
  test: { include: ['tests/**/*.test.js'], testTimeout: 30_000, hookTimeout: 30_000 },
})
