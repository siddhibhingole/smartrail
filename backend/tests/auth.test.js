import { test } from 'vitest'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/smartrail_test'
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-thirty-two-characters'

const { allowRoles, requireAuth } = await import('../dist/middleware/auth.js')

function invoke(handler, user, authorization) {
  let forwarded
  handler({ user, header: name => name === 'authorization' ? authorization : undefined }, {}, error => { forwarded = error })
  return forwarded
}

test('protected admin actions reject guests and passengers, and accept admins', () => {
  const guard = allowRoles('ADMIN')
  assert.equal(invoke(guard, undefined)?.status, 403)
  assert.equal(invoke(guard, { id: 'passenger-1', role: 'PASSENGER' })?.status, 403)
  assert.equal(invoke(guard, { id: 'admin-1', role: 'ADMIN' }), undefined)
})

test('authentication guard rejects missing credentials with 401', () => {
  assert.equal(invoke(requireAuth, undefined)?.status, 401)
})
