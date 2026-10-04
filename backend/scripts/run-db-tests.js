import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const directory = dirname(fileURLToPath(import.meta.url))
const databaseUrl = process.env.DATABASE_TEST_URL
if (!databaseUrl) {
  console.error('Set DATABASE_TEST_URL to a dedicated PostgreSQL test database before running integration tests.')
  process.exit(1)
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').split('/').at(-1) ?? ''
if (!/test/i.test(databaseName)) {
  console.error('Refusing to run database fixtures unless DATABASE_TEST_URL names a database containing "test".')
  process.exit(1)
}

const backendDirectory = resolve(directory, '..')
const environment = { ...process.env, DATABASE_URL: databaseUrl, RUN_DB_TESTS: '1' }
const prisma = resolve(backendDirectory, 'node_modules/prisma/build/index.js')
const migrate = spawnSync(process.execPath, [prisma, 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { cwd: backendDirectory, stdio: 'inherit', env: environment })
if (migrate.status !== 0) process.exit(migrate.status ?? 1)
const vitest = resolve(backendDirectory, 'node_modules/vitest/vitest.mjs')
const tests = spawnSync(process.execPath, [vitest, 'run', '--config', 'vitest.config.ts', '--configLoader', 'native'], { cwd: backendDirectory, stdio: 'inherit', env: environment })
process.exit(tests.status ?? 1)
