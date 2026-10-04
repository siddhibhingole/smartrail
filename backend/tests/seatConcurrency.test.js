import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../dist/config/prisma.js'
import { bookingService } from '../dist/services/bookingService.js'

afterAll(async () => prisma.$disconnect())

test.skipIf(process.env.RUN_DB_TESTS !== '1')('only one of two concurrent requests can reserve a seat for the same date', async () => {
  const suffix = randomUUID().slice(0, 8)
  const user = await prisma.user.create({ data: { name: 'Concurrency Test', email: `seat-test-${suffix}@example.test`, passwordHash: 'test-only-not-a-login' } })
  const train = await prisma.train.create({ data: { trainNumber: `T${suffix}`, trainName: 'Concurrency Test Express', source: 'Test A', destination: 'Test B', departureTime: '08:00', arrivalTime: '10:00', duration: '2h', baseFare: 300 } })
  const coach = await prisma.coach.create({ data: { trainId: train.id, coachNumber: 'B2', coachType: 'AC 3 Tier', capacity: 1 } })
  const seat = await prisma.seat.create({ data: { coachId: coach.id, seatNumber: '36', seatType: 'WINDOW' } })
  const groupSeatIds = []
  const journeyDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const journeyDateValue = new Date(`${journeyDate}T00:00:00.000Z`)
  const input = (key, travelClass = '3A') => ({ trainId: train.id, journeyDate, passengers: [{ fullName: 'Test Passenger', age: 24, gender: 'UNDISCLOSED' }], seatIds: [seat.id], groupBooking: false, travelClass, paymentMethod: 'UPI', idempotencyKey: key })

  try {
    await assert.rejects(bookingService.create(user.id, input(`class-mismatch-${suffix}`, '2A')), error => error.code === 'SEAT_UNAVAILABLE' && error.status === 409)
    assert.equal(await prisma.booking.count({ where: { userId: user.id } }), 0)
    const results = await Promise.allSettled([bookingService.create(user.id, input(`test-${suffix}-a`)), bookingService.create(user.id, input(`test-${suffix}-b`))])
    const succeeded = results.filter(result => result.status === 'fulfilled')
    const failed = results.filter(result => result.status === 'rejected')
    assert.equal(succeeded.length, 1)
    assert.equal(succeeded[0].value.status, 'PENDING')
    assert.equal(succeeded[0].value.payment.status, 'PENDING')
    assert.equal(failed.length, 1)
    assert.equal(failed[0].reason.code, 'SEAT_UNAVAILABLE')
    assert.equal(failed[0].reason.status, 409)
    assert.equal(await prisma.seatAllocation.count({ where: { seatId: seat.id, journeyDate: journeyDateValue, status: 'HELD' } }), 1)
    await bookingService.cancel(user.id, 'PASSENGER', succeeded[0].value.id)
    const cancelled = await prisma.booking.findUnique({ where: { id: succeeded[0].value.id }, include: { payment: true } })
    assert.equal(cancelled.status, 'CANCELLED')
    assert.equal(cancelled.payment.status, 'FAILED')
    assert.equal(await prisma.seatAllocation.count({ where: { seatId: seat.id, journeyDate: journeyDateValue } }), 0)

    const groupCoach = await prisma.coach.create({ data: { trainId: train.id, coachNumber: 'B3', coachType: 'AC 3 Tier', capacity: 2 } })
    const freeGroupSeat = await prisma.seat.create({ data: { coachId: groupCoach.id, seatNumber: '01', seatType: 'WINDOW' } })
    const occupiedGroupSeat = await prisma.seat.create({ data: { coachId: groupCoach.id, seatNumber: '02', seatType: 'MIDDLE' } })
    groupSeatIds.push(freeGroupSeat.id, occupiedGroupSeat.id)
    await prisma.seatAllocation.create({ data: { seatId: occupiedGroupSeat.id, journeyDate: journeyDateValue, status: 'BOOKED' } })
    const bookingsBeforeGroupRequest = await prisma.booking.count({ where: { userId: user.id } })
    await assert.rejects(bookingService.create(user.id, { trainId: train.id, journeyDate, passengers: [{ fullName: 'Passenger One', age: 24, gender: 'UNDISCLOSED' }, { fullName: 'Passenger Two', age: 26, gender: 'UNDISCLOSED' }], seatIds: groupSeatIds, groupBooking: true, travelClass: '3A', paymentMethod: 'UPI', idempotencyKey: `group-${suffix}-rollback` }), error => error.code === 'SEAT_UNAVAILABLE' && error.status === 409)
    assert.equal(await prisma.booking.count({ where: { userId: user.id } }), bookingsBeforeGroupRequest)
    assert.equal(await prisma.booking.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: `group-${suffix}-rollback` } } }), null)
  } finally {
    const bookingIds = (await prisma.booking.findMany({ where: { userId: user.id }, select: { id: true } })).map(b => b.id)
    await prisma.undoTransaction.deleteMany({ where: { userId: user.id } })
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    await prisma.booking.deleteMany({ where: { userId: user.id } })
    await prisma.passenger.deleteMany({ where: { userId: user.id } })
    await prisma.auditLog.deleteMany({ where: { userId: user.id } })
    await prisma.seatAllocation.deleteMany({ where: { seatId: seat.id } })
    if (groupSeatIds.length) await prisma.seatAllocation.deleteMany({ where: { seatId: { in: groupSeatIds } } })
    await prisma.train.delete({ where: { id: train.id } })
    await prisma.user.delete({ where: { id: user.id } })
  }
})
