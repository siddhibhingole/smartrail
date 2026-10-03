import { randomInt } from 'node:crypto'
import { AllocationStatus, BookingStatus, PaymentMethod, PaymentStatus, Prisma, TransactionStatus, TransactionType, WaitingStatus } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/http.js'
import { processMockPayment, refundMockPayment } from './paymentService.js'
import { seatService } from './seatService.js'

type BookingRequest = { trainId: string; journeyDate: string; passengers: Array<{ fullName: string; age: number; gender: 'FEMALE'|'MALE'|'NON_BINARY'|'UNDISCLOSED'; phone?: string; idType?: string; idNumber?: string; seatPreference?: 'WINDOW'|'MIDDLE'|'AISLE' }>; seatPreference?: 'WINDOW'|'MIDDLE'|'AISLE'; seatIds?: string[]; groupBooking: boolean; paymentMethod: PaymentMethod; idempotencyKey: string }
const passengerSelect = { id: true, fullName: true, age: true, gender: true, phone: true } as const
const pnr = () => `SR${randomInt(100000, 1_000_000)}`
const reference = () => `TX-${randomInt(10_000_000, 100_000_000)}`

export const bookingService = {
  async create(userId: string, input: BookingRequest) {
    const journeyDate = new Date(`${input.journeyDate}T00:00:00.000Z`)
    return retrySerializable(async () => prisma.$transaction(async tx => {
      const prior = await tx.booking.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } }, include: { passengers: { include: { passenger: { select: passengerSelect }, seat: true, coach: true } }, payment: true } })
      if (prior) return prior
      const train = await tx.train.findUnique({ where: { id: input.trainId } })
      if (!train) throw new AppError(404, 'TRAIN_NOT_FOUND', 'Train was not found.')
      await seatService.releaseExpired(tx)
      const selected = await seatService.available(tx, train.id, journeyDate, input.passengers.length, input.seatPreference ?? input.passengers[0]?.seatPreference, input.seatIds, input.groupBooking)
      if (input.seatIds && selected.length < input.seatIds.length) throw new AppError(409, 'SEAT_UNAVAILABLE', 'One or more selected seats are no longer available.')
      const waiting = selected.length < input.passengers.length
      const fareEach = new Prisma.Decimal(train.baseFare)
      const totalAmount = waiting ? new Prisma.Decimal(0) : fareEach.mul(input.passengers.length)
      const booking = await tx.booking.create({ data: { pnr: pnr(), userId, trainId: train.id, journeyDate, status: waiting ? BookingStatus.WAITING : BookingStatus.PENDING, totalAmount, idempotencyKey: input.idempotencyKey } })
      const passengers = []
      for (const [index, passenger] of input.passengers.entries()) {
        const created = await tx.passenger.create({ data: { userId, fullName: passenger.fullName, age: passenger.age, gender: passenger.gender, phone: passenger.phone, idType: passenger.idType, idNumber: passenger.idNumber } })
        passengers.push(await tx.bookingPassenger.create({ data: { bookingId: booking.id, passengerId: created.id, position:index, seatPreference: (passenger.seatPreference ?? input.seatPreference) as never, fare: fareEach, ...(waiting ? {} : { seatId: selected[index]?.id, coachId: selected[index]?.coachId }) }, include: { passenger: { select: passengerSelect }, seat: true, coach: true } }))
      }
      if (waiting) {
        const last = await tx.waitingList.aggregate({ where: { status: WaitingStatus.WAITING, booking: { trainId: train.id, journeyDate } }, _max: { position: true } })
        const position = (last._max.position ?? 0) + 1
        await tx.waitingList.create({ data: { bookingId: booking.id, position } })
        await tx.transaction.create({ data: { userId, bookingId: booking.id, type: TransactionType.BOOKING, status: TransactionStatus.SUCCESS, amount: 0, referenceId: reference() } })
        await tx.auditLog.create({ data: { userId, action: 'BOOKING_WAITLISTED', entity: 'Booking', entityId: booking.id, metadata: { position } } })
        return { ...booking, passengers, allocationStatus: 'WAITING', waitingPosition: position, payment: null }
      }
      const hold = await seatService.hold(tx, selected, journeyDate)
      const outcome = processMockPayment()
      const transaction = await tx.transaction.create({ data: { userId, bookingId: booking.id, type: TransactionType.BOOKING, status: outcome.status === PaymentStatus.PENDING ? TransactionStatus.PROCESSING : outcome.status === PaymentStatus.SUCCESS ? TransactionStatus.SUCCESS : TransactionStatus.FAILED, amount: totalAmount, paymentMethod: input.paymentMethod, referenceId: reference() } })
      const payment = await tx.payment.create({ data: { transactionId: transaction.id, bookingId: booking.id, amount: totalAmount, paymentMethod: input.paymentMethod, status: outcome.status, gatewayReference: outcome.reference } })
      if (outcome.status === PaymentStatus.FAILED) {
        await tx.seatAllocation.deleteMany({ where: { holdToken: hold.holdToken } })
        await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.FAILED } })
        await tx.auditLog.create({ data: { userId, action: 'PAYMENT_FAILED', entity: 'Booking', entityId: booking.id } })
        return { ...booking, status: BookingStatus.FAILED, passengers, payment, allocationStatus: 'PAYMENT_FAILED', allocationReason: 'Payment failed; held seats were released.' }
      }
      if (outcome.status === PaymentStatus.SUCCESS) {
        for (const [index, seat] of selected.entries()) await tx.seatAllocation.update({ where: { seatId_journeyDate: { seatId: seat.id, journeyDate } }, data: { status: AllocationStatus.BOOKED, holdToken: null, heldUntil: null, bookingPassengerId: passengers[index]!.id } })
        await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED } })
        await tx.undoTransaction.create({ data: { userId, transactionId: transaction.id, operation: 'BOOKING', payload: { bookingId: booking.id } } })
        await tx.auditLog.create({ data: { userId, action: 'BOOKING_CREATED', entity: 'Booking', entityId: booking.id, metadata: { pnr: booking.pnr } } })
        return { ...booking, status: BookingStatus.CONFIRMED, passengers, payment, allocationStatus: input.groupBooking ? 'GROUP_ALLOCATED' : 'ALLOCATED', allocationReason: 'Seat assignment committed after successful mock payment.' }
      }
      await tx.auditLog.create({ data: { userId, action: 'PAYMENT_PENDING', entity: 'Booking', entityId: booking.id } })
      return { ...booking, passengers, payment, allocationStatus: 'PAYMENT_PENDING', holdToken: hold.holdToken, heldUntil: hold.heldUntil }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }))
  },

  async get(userId: string, role: string, id: string) {
    const booking = await prisma.booking.findUnique({ where: { id }, include: { passengers: { include: { passenger: { select: passengerSelect }, seat: true, coach: true, allocation: true } }, train: true, payment: true, waitingList: true } })
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.')
    if (role === 'PASSENGER' && booking.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You cannot view this booking.')
    return booking
  },

  async pnrLookup(pnrValue: string, userId: string, role: string) {
    const booking = await prisma.booking.findUnique({ where: { pnr: pnrValue.toUpperCase() }, include: { passengers: { include: { passenger: { select: passengerSelect }, seat: { select: { seatNumber: true, seatType: true } }, coach: { select: { coachNumber: true } } } }, train: true, payment: { select: { status: true, paymentMethod: true, amount: true, createdAt: true } }, waitingList: true } })
    if (!booking) throw new AppError(404, 'PNR_NOT_FOUND', 'No booking was found for this PNR.')
    if (role === 'PASSENGER' && booking.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You cannot view this booking.')
    return booking
  },

  async list(userId: string, role: string) {
    return prisma.booking.findMany({ where: role === 'PASSENGER' ? { userId } : {}, include: { train: true, passengers: { include: { passenger: { select: passengerSelect }, seat: true, coach: true } }, payment: true, waitingList: true }, orderBy: { createdAt: 'desc' }, take: 200 })
  },

  async cancel(userId: string, role: string, bookingId: string) {
    return retrySerializable(() => prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { passengers: true, payment: true, waitingList: true } })
      if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.')
      if (role === 'PASSENGER' && booking.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You cannot cancel this booking.')
      if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.WAITING) throw new AppError(409, 'INVALID_BOOKING_STATE', `A ${booking.status.toLowerCase()} booking cannot be cancelled.`)
      const cancelled = await tx.booking.updateMany({ where: { id: booking.id, status: booking.status }, data: { status: BookingStatus.CANCELLED } })
      if (!cancelled.count) throw new AppError(409, 'BOOKING_ALREADY_CANCELLED', 'This booking has already changed state.')
      await tx.seatAllocation.deleteMany({ where: { OR: [{ bookingPassengerId: { in: booking.passengers.map(p => p.id) } }, { seatId: { in: booking.passengers.flatMap(p => p.seatId ? [p.seatId] : []) }, journeyDate: booking.journeyDate }] } })
      if (booking.waitingList) await tx.waitingList.update({ where: { id: booking.waitingList.id }, data: { status: WaitingStatus.CANCELLED } })
      const cancelTxn = await tx.transaction.create({ data: { userId, bookingId: booking.id, type: TransactionType.CANCELLATION, status: TransactionStatus.SUCCESS, amount: booking.totalAmount, paymentMethod: booking.payment?.paymentMethod, referenceId: reference() } })
      let refund = null
      if (booking.payment?.status === PaymentStatus.SUCCESS) {
        const refundStatus = refundMockPayment()
        refund = await tx.transaction.create({ data: { userId, bookingId: booking.id, type: TransactionType.REFUND, status: refundStatus === PaymentStatus.REFUNDED ? TransactionStatus.SUCCESS : TransactionStatus.PROCESSING, amount: booking.totalAmount, paymentMethod: booking.payment.paymentMethod, referenceId: reference() } })
        await tx.payment.update({ where: { id: booking.payment.id }, data: { status: refundStatus } })
      }
      const waitingRows = await tx.waitingList.findMany({ where: { status: WaitingStatus.WAITING, booking: { trainId: booking.trainId, journeyDate: booking.journeyDate } }, include: { booking: { include: { passengers: true } } }, orderBy: [{ createdAt: 'asc' }, { position: 'asc' }] })
      let promoted = false
      let promotedBookingId: string | null = null
      for (const waiting of waitingRows) {
        promoted = await seatService.reserveForWaiting(tx, booking.trainId, booking.journeyDate, waiting.bookingId, waiting.booking.passengers.map(p => p.passengerId))
        if (promoted) {
          promotedBookingId = waiting.bookingId
          await tx.booking.update({ where: { id: waiting.bookingId }, data: { status: BookingStatus.CONFIRMED } })
          await tx.waitingList.update({ where: { id: waiting.id }, data: { status: WaitingStatus.PROMOTED, promotedAt: new Date() } })
          await tx.transaction.create({ data: { userId, bookingId: waiting.bookingId, type: TransactionType.WAITING_LIST_PROMOTION, status: TransactionStatus.SUCCESS, amount: waiting.booking.totalAmount, referenceId: reference() } })
          await tx.auditLog.create({ data: { userId, action: 'WAITING_LIST_PROMOTED', entity: 'Booking', entityId: waiting.bookingId } })
          await reorderQueue(tx, booking.trainId, booking.journeyDate)
          break
        }
      }
      const undoAvailable = !promoted && (booking.status === BookingStatus.WAITING || !booking.payment || refund?.status === TransactionStatus.SUCCESS)
      await tx.undoTransaction.create({ data: { userId, transactionId: cancelTxn.id, operation: 'CANCELLATION', payload: { bookingId: booking.id, passengerIds: booking.passengers.map(p => p.id), previousStatus: booking.status }, reversible: undoAvailable } })
      await tx.auditLog.create({ data: { userId, action: 'BOOKING_CANCELLED', entity: 'Booking', entityId: booking.id, metadata: { refundId: refund?.id ?? null, promoted } } })
      return { bookingId: booking.id, status: BookingStatus.CANCELLED, refund: refund ? { transactionId: refund.id, status: refund.status } : null, promotedBookingId, undoAvailable }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }))
  },
}

async function reorderQueue(tx: Prisma.TransactionClient, trainId: string, journeyDate: Date) {
  const rows = await tx.waitingList.findMany({ where: { status: WaitingStatus.WAITING, booking: { trainId, journeyDate } }, orderBy: [{ createdAt: 'asc' }, { position: 'asc' }], select: { id: true } })
  for (const [i, row] of rows.entries()) await tx.waitingList.update({ where: { id: row.id }, data: { position: i + 1 } })
}

async function retrySerializable<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation() }
    catch (error) { if (attempt >= retries || !isSerializationConflict(error)) throw error }
  }
}
function isSerializationConflict(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002') }
