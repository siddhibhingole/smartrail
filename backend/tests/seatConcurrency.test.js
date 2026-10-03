import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../dist/config/prisma.js'
import { bookingService } from '../dist/services/bookingService.js'

test('only one of two concurrent requests can reserve a seat for the same date', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  process.env.MOCK_PAYMENT_SUCCESS_RATE = '1'
  const suffix = randomUUID().slice(0, 8)
  const user = await prisma.user.create({ data: { name: 'Concurrency Test', email: `seat-test-${suffix}@smartrail.demo`, passwordHash: 'test-only-not-a-login' } })
  const train = await prisma.train.create({ data: { trainNumber: `T${suffix}`, trainName: 'Concurrency Test Express', source: 'Test A', destination: 'Test B', departureTime: '08:00', arrivalTime: '10:00', duration: '2h', baseFare: 300 } })
  const coach = await prisma.coach.create({ data: { trainId: train.id, coachNumber: 'B2', coachType: 'AC 3 Tier', capacity: 1 } })
  const seat = await prisma.seat.create({ data: { coachId: coach.id, seatNumber: '36', seatType: 'WINDOW' } })
  const journeyDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const input = key => ({ trainId: train.id, journeyDate, passengers: [{ fullName: 'Test Passenger', age: 24, gender: 'UNDISCLOSED' }], seatIds: [seat.id], groupBooking: false, paymentMethod: 'UPI', idempotencyKey: key })

  try {
    const results = await Promise.allSettled([bookingService.create(user.id, input(`test-${suffix}-a`)), bookingService.create(user.id, input(`test-${suffix}-b`))])
    const succeeded = results.filter(result => result.status === 'fulfilled')
    const failed = results.filter(result => result.status === 'rejected')
    assert.equal(succeeded.length, 1)
    assert.equal(succeeded[0].value.status, 'CONFIRMED')
    assert.equal(failed.length, 1)
    assert.equal(failed[0].reason.code, 'SEAT_UNAVAILABLE')
    assert.equal(failed[0].reason.status, 409)
    assert.equal(await prisma.seatAllocation.count({ where: { seatId: seat.id, journeyDate } }), 1)
  } finally {
    const bookingIds = (await prisma.booking.findMany({ where: { userId: user.id }, select: { id: true } })).map(b => b.id)
    await prisma.undoTransaction.deleteMany({ where: { userId: user.id } })
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    await prisma.booking.deleteMany({ where: { userId: user.id } })
    await prisma.passenger.deleteMany({ where: { userId: user.id } })
    await prisma.auditLog.deleteMany({ where: { userId: user.id } })
    await prisma.seatAllocation.deleteMany({ where: { seatId: seat.id } })
    await prisma.train.delete({ where: { id: train.id } })
    await prisma.user.delete({ where: { id: user.id } })
  }
})
