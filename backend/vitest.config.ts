import { defineConfig } from 'vitest/config'

export default defineConfig({
  configFile: false,
  root: process.cwd(),
  test: { include: ['tests/**/*.test.ts'] },
})
