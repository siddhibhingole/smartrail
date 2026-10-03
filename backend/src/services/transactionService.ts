import { randomUUID } from 'node:crypto'
import { AllocationStatus, BookingStatus, PaymentStatus, Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/http.js'
import { seatService } from './seatService.js'
import { processMockPayment } from './paymentService.js'

const ref = () => `TX-${randomUUID()}`
export const transactionService = {
  async list(userId: string, role: string, filters: { type?: string; status?: string; bookingId?: string; from?: string; to?: string }) {
    return prisma.transaction.findMany({
      where: {
        ...(role === 'PASSENGER' ? { userId } : {}),
        ...(filters.type ? { type: filters.type as never } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
        ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } } : {}),
      },
      include: { booking: { select: { id: true, pnr: true, status: true } }, payment: { select: { status: true, paymentMethod: true, amount: true } } },
      orderBy: { createdAt: 'desc' }, take: 300,
    })
  },
  async get(id: string, userId: string, role: string) {
    const item = await prisma.transaction.findUnique({ where: { id }, include: { booking: { select: { id: true, pnr: true, status: true } }, payment: true } })
    if (!item) throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found.')
    if (role === 'PASSENGER' && item.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You cannot view this transaction.')
    return item
  },
  async undo(userId: string) {
    return prisma.$transaction(async tx => {
      const entry = await tx.undoTransaction.findFirst({ where: { userId, reversible: true, reversedAt: null }, include: { transaction: true }, orderBy: { createdAt: 'desc' } })
      if (!entry) throw new AppError(409, 'NOTHING_TO_UNDO', 'There is no reversible transaction to undo.')
      const payload = entry.payload as { bookingId?: string; passengerIds?: string[]; previousStatus?: 'CONFIRMED'|'WAITING' }
      if (!payload.bookingId) throw new AppError(409, 'UNDO_UNSUPPORTED', 'This operation cannot be safely reversed.')
      const booking = await tx.booking.findUnique({ where: { id: payload.bookingId }, include: { passengers: true, payment: true, waitingList: true } })
      if (!booking) throw new AppError(409, 'UNDO_CONFLICT', 'The original booking no longer exists.')

      if (entry.operation === 'BOOKING') {
        if (booking.status !== BookingStatus.CONFIRMED) throw new AppError(409, 'UNDO_CONFLICT', 'The booking has changed since it was created.')
        await tx.seatAllocation.deleteMany({ where: { bookingPassengerId: { in: booking.passengers.map(p => p.id) } } })
        await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED } })
        if (booking.payment) await tx.payment.update({ where: { id: booking.payment.id }, data: { status: PaymentStatus.REFUNDED } })
      } else if (entry.operation === 'CANCELLATION') {
        if (booking.status !== BookingStatus.CANCELLED) throw new AppError(409, 'UNDO_CONFLICT', 'The cancelled booking has changed since it was cancelled.')
        if (payload.previousStatus === 'WAITING') {
          const last = await tx.waitingList.aggregate({ where: { status: 'WAITING', booking: { trainId: booking.trainId, journeyDate: booking.journeyDate } }, _max: { position: true } })
          if (booking.waitingList) await tx.waitingList.update({ where: { id: booking.waitingList.id }, data: { status: 'WAITING', position: (last._max.position ?? 0) + 1, promotedAt: null } })
          else await tx.waitingList.create({ data: { bookingId: booking.id, position: (last._max.position ?? 0) + 1 } })
          await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.WAITING } })
        } else {
        const passengerRows = booking.passengers.filter(p => payload.passengerIds?.includes(p.id))
        const journeyDate = booking.journeyDate
        const seats = await seatService.available(tx, booking.trainId, journeyDate, passengerRows.length)
        if (seats.length < passengerRows.length) throw new AppError(409, 'UNDO_CONFLICT', 'Released seats have since been assigned to another passenger.')
        const paymentAttempt = booking.payment ? processMockPayment() : null
        if (paymentAttempt && paymentAttempt.status !== PaymentStatus.SUCCESS) throw new AppError(409, 'UNDO_PAYMENT_FAILED', 'The demo payment could not be re-authorized, so this cancellation cannot be undone yet.')
        await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED } })
        await tx.seatAllocation.createMany({ data: seats.map(s => ({ seatId: s.id, journeyDate, status: AllocationStatus.BOOKED })) })
        for (const [index, passenger] of passengerRows.entries()) {
          const seat = seats[index]!
          await tx.bookingPassenger.update({ where: { id: passenger.id }, data: { seatId: seat.id, coachId: seat.coachId } })
          await tx.seatAllocation.update({ where: { seatId_journeyDate: { seatId: seat.id, journeyDate } }, data: { bookingPassengerId: passenger.id } })
        }
        if (booking.payment && paymentAttempt) await tx.payment.update({ where: { id: booking.payment.id }, data: { status: PaymentStatus.SUCCESS, gatewayReference: paymentAttempt.reference } })
        if (booking.waitingList) await tx.waitingList.update({ where: { id: booking.waitingList.id }, data: { status: 'CANCELLED' } })
        }
      } else {
        throw new AppError(409, 'UNDO_UNSUPPORTED', 'This operation cannot be safely reversed.')
      }

      await tx.undoTransaction.update({ where: { id: entry.id }, data: { reversedAt: new Date() } })
      await tx.transaction.update({ where: { id: entry.transactionId }, data: { status: TransactionStatus.REVERSED } })
      await tx.transaction.create({ data: { userId, bookingId: booking.id, type: TransactionType.UNDO, status: TransactionStatus.SUCCESS, amount: booking.totalAmount, referenceId: ref() } })
      await tx.auditLog.create({ data: { userId, action: 'UNDO_EXECUTED', entity: 'Booking', entityId: booking.id, metadata: { operation: entry.operation } } })
      return { bookingId: booking.id, operation: entry.operation, status: 'REVERSED' }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  },
}
