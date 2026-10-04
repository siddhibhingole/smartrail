import { test } from 'vitest'
import assert from 'node:assert/strict'
import { bookingSchema, holdSchema, passengerSchema } from '../dist/validators/schemas.js'

const base = { trainId: 'train-1', journeyDate: '2026-10-12', passengers: [{ fullName: 'Asha Rao', age: 28 }], groupBooking: false, paymentMethod: 'UPI', idempotencyKey: 'request-123456' }

test('applies passenger defaults and accepts a valid booking DTO', () => {
  const result = bookingSchema.safeParse({ body: base })
  assert.equal(result.success, true)
  if (result.success) assert.equal(result.data.body.passengers[0].gender, 'UNDISCLOSED')
  assert.equal(bookingSchema.safeParse({ body: { ...base, travelClass: '3A' } }).success, true)
  assert.equal(bookingSchema.safeParse({ body: { ...base, travelClass: '2AC' } }).success, false)
})

test('rejects malformed dates, incomplete groups, mismatched seats, and duplicate seats', () => {
  assert.equal(bookingSchema.safeParse({ body: { ...base, journeyDate: 'tomorrow' } }).success, false)
  assert.equal(bookingSchema.safeParse({ body: { ...base, groupBooking: true } }).success, false)
  assert.equal(bookingSchema.safeParse({ body: { ...base, passengers: [...base.passengers, { fullName: 'Neel Rao', age: 30 }], seatIds: ['seat-a'] } }).success, false)
  assert.equal(bookingSchema.safeParse({ body: { ...base, passengers: [...base.passengers, { fullName: 'Neel Rao', age: 30 }], groupBooking: true, seatIds: ['seat-a', 'seat-a'] } }).success, false)
  assert.equal(bookingSchema.safeParse({ body: { ...base, passengers: [...base.passengers, { fullName: 'Neel Rao', age: 30 }], seatIds: ['seat-a'] } }).success, false)
  assert.equal(bookingSchema.safeParse({ body: { ...base, passengers: Array.from({ length: 5 }, (_, index) => ({ fullName: `Passenger ${index}`, age: 30 })), quota: 'TATKAL' } }).success, false)
  assert.equal(holdSchema.safeParse({ body: { trainId: 'train-1', journeyDate: '2026-10-12', passengerCount: 5, quota: 'TATKAL' } }).success, false)
})

test('rejects invalid passenger input at the API boundary', () => {
  assert.equal(passengerSchema.safeParse({ body: { fullName: 'A', age: 0 } }).success, false)
})
