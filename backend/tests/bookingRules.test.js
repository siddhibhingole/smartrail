import { test } from 'vitest'
import assert from 'node:assert/strict'
import { findContiguousGroup, isContiguousGroup } from '../dist/domain/bookingRules.js'

const seat = (coachId, seatNumber) => ({ id: `${coachId}-${seatNumber}`, coachId, seatNumber: String(seatNumber) })

test('finds a complete contiguous block within one coach', () => {
  const candidates = [seat('A', 1), seat('A', 2), seat('A', 4), seat('B', 1), seat('B', 2), seat('B', 3)]
  assert.deepEqual(findContiguousGroup(candidates, 3), [seat('B', 1), seat('B', 2), seat('B', 3)])
})

test('rejects partial, split-coach, and non-adjacent requested groups', () => {
  assert.equal(isContiguousGroup([seat('A', 1), seat('A', 3)]), false)
  assert.equal(isContiguousGroup([seat('A', 1), seat('B', 2)]), false)
  assert.equal(findContiguousGroup([seat('A', 1), seat('A', 3)], 2), null)
})

test('allows a singleton for ordinary seat selection', () => {
  assert.equal(isContiguousGroup([seat('A', 8)]), true)
  assert.deepEqual(findContiguousGroup([seat('A', 8)], 1), [seat('A', 8)])
})
