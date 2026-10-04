import { test } from 'vitest'
import assert from 'node:assert/strict'
import { calculateQuotaFare, getQuotaPolicy } from '../dist/domain/quotaRules.js'

test('Tatkal applies a 1.3 fare multiplier and caps bookings at four passengers', () => {
  assert.equal(calculateQuotaFare(1000, 2, 'TATKAL'), 2600)
  assert.equal(getQuotaPolicy('TATKAL').maxPassengers, 4)
  assert.throws(() => calculateQuotaFare(1000, 5, 'TATKAL'), /up to 4 passengers/)
})

test('General quota keeps the base fare and the eight-passenger limit', () => {
  assert.equal(calculateQuotaFare(1000, 2, 'GENERAL'), 2000)
  assert.equal(getQuotaPolicy('GENERAL').maxPassengers, 8)
  assert.ok(getQuotaPolicy('GENERAL').maxPassengers > getQuotaPolicy('TATKAL').maxPassengers)
})
