import { Prisma, type SeatType } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { AppError } from '../utils/http.js'
import { findContiguousGroup, isContiguousGroup } from '../domain/bookingRules.js'
import { coachTypesForClass, type TravelClass } from '../domain/travelClass.js'

export type AvailableSeat = { id: string; seatNumber: string; seatType: SeatType; coachId: string; coachNumber: string }
export const seatService = {
  async available(tx: Prisma.TransactionClient, trainId: string, journeyDate: Date, limit: number, preference?: SeatType, requestedSeatIds?: string[], groupBooking = false, travelClass: TravelClass = 'ALL') {
    await tx.seatAllocation.deleteMany({ where: { journeyDate, status: 'HELD', heldUntil: { lte: new Date() } } })
    const requestedFilter = requestedSeatIds?.length ? Prisma.sql`AND s."id" IN (${Prisma.join(requestedSeatIds)})` : Prisma.empty
    const coachTypes = coachTypesForClass(travelClass)
    const classFilter = coachTypes ? Prisma.sql`AND c."coachType" IN (${Prisma.join(coachTypes)})` : Prisma.empty
    const rows = await tx.$queryRaw<AvailableSeat[]>(Prisma.sql`
      SELECT s."id", s."seatNumber", s."seatType", c."id" AS "coachId", c."coachNumber"
      FROM "Seat" s JOIN "Coach" c ON c."id" = s."coachId"
      WHERE c."trainId" = ${trainId}
        ${requestedFilter}
        ${classFilter}
        AND NOT EXISTS (SELECT 1 FROM "SeatAllocation" a WHERE a."seatId" = s."id" AND a."journeyDate" = ${journeyDate} AND (a."status" = 'BOOKED' OR (a."status" = 'HELD' AND a."heldUntil" > NOW())))
      ORDER BY c."coachNumber", s."seatNumber"
      LIMIT ${limit * 4}
      FOR UPDATE OF s SKIP LOCKED
    `)
    if (requestedSeatIds?.length) {
      const selected = requestedSeatIds.map(id => rows.find(seat => seat.id === id)).filter((seat): seat is AvailableSeat => Boolean(seat))
      return groupBooking && !isContiguousGroup(selected.map(seat => ({...seat, seatNumber:seat.seatNumber}))) ? [] : selected
    }
    let ordered = preference ? [...rows.filter(s => s.seatType === preference), ...rows.filter(s => s.seatType !== preference)] : rows
    if (groupBooking && limit > 1) {
      const contiguous = findContiguousGroup(ordered,limit)
      if(contiguous)return contiguous
      const coaches = [...new Set(ordered.map(seat => seat.coachId))]
      const sameCoach = coaches.map(id=>ordered.filter(seat=>seat.coachId===id)).find(group=>group.length>=limit)
      if (sameCoach) ordered=[...sameCoach,...ordered.filter(seat=>seat.coachId!==sameCoach[0]!.coachId)]
    }
    return ordered.slice(0, limit)
  },
  async hold(tx: Prisma.TransactionClient, seats: AvailableSeat[], journeyDate: Date, minutes = 5) {
    const holdToken = randomUUID()
    const heldUntil = new Date(Date.now() + minutes * 60_000)
    await tx.seatAllocation.createMany({ data: seats.map(seat => ({ seatId: seat.id, journeyDate, status: 'HELD', holdToken, heldUntil })) })
    return { holdToken, heldUntil }
  },
  async releaseExpired(tx: Prisma.TransactionClient) { return tx.seatAllocation.deleteMany({ where: { status: 'HELD', heldUntil: { lte: new Date() } } }) },
  async reserveForWaiting(tx: Prisma.TransactionClient, trainId: string, journeyDate: Date, bookingId: string, passengerIds: string[], travelClass: TravelClass = 'ALL') {
    const seats = await this.available(tx, trainId, journeyDate, passengerIds.length, undefined, undefined, passengerIds.length > 1, travelClass)
    if (seats.length < passengerIds.length) return false
    await tx.seatAllocation.createMany({ data: seats.map(s => ({ seatId: s.id, journeyDate, status: 'BOOKED' })) })
    for (const [index, seat] of seats.entries()) {
      const passengerId = passengerIds[index]
      const updated = await tx.bookingPassenger.updateMany({ where: { bookingId, passengerId }, data: { seatId: seat.id, coachId: seat.coachId } })
      if (!updated.count) throw new AppError(409, 'WAITING_LIST_CHANGED', 'The waiting-list booking changed during promotion.')
      const bp = await tx.bookingPassenger.findFirstOrThrow({ where: { bookingId, passengerId } })
      await tx.seatAllocation.update({ where: { seatId_journeyDate: { seatId: seat.id, journeyDate } }, data: { bookingPassengerId: bp.id } })
    }
    return true
  },
}
