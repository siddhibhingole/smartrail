import { test } from 'vitest'
import assert from 'node:assert/strict'
import { coachTypesForClass } from '../dist/domain/travelClass.js'

test('class aliases map to the corresponding coach inventory labels', () => {
  assert.deepEqual(coachTypesForClass('1A'), ['1A', 'AC 1 Tier', 'First AC', 'AC First Class'])
  assert.deepEqual(coachTypesForClass('3A'), ['3A', 'AC 3 Tier', 'Third AC'])
  assert.deepEqual(coachTypesForClass('SL'), ['SL', 'Sleeper', 'Sleeper Class'])
  assert.equal(coachTypesForClass('ALL'), undefined)
})
