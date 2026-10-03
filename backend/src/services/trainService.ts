import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { trainRepository } from '../repositories/trainRepository.js'
import { AppError } from '../utils/http.js'

export const trainService = {
  list: (query?: { from?: string; to?: string; q?: string }) => trainRepository.list({ from: query?.from, to: query?.to, search: query?.q }),
  async get(id: string) { const train = await trainRepository.byId(id); if (!train) throw new AppError(404, 'TRAIN_NOT_FOUND', 'Train was not found.'); return train },
  async create(data: { trainNumber: string; trainName: string; source: string; destination: string; departureTime: string; arrivalTime: string; duration: string; baseFare: number }) { return prisma.train.create({ data: { ...data, baseFare: new Prisma.Decimal(data.baseFare) } }) },
  async update(id: string, data: Partial<{ trainNumber: string; trainName: string; source: string; destination: string; departureTime: string; arrivalTime: string; duration: string; baseFare: number }>) { const exists = await prisma.train.findUnique({ where: { id }, select: { id: true } }); if (!exists) throw new AppError(404, 'TRAIN_NOT_FOUND', 'Train was not found.'); return prisma.train.update({ where: { id }, data: { ...data, ...(data.baseFare === undefined ? {} : { baseFare: new Prisma.Decimal(data.baseFare) }) } }) },
  async remove(id: string) { try { await prisma.train.delete({ where: { id } }); return { deleted: true } } catch (error) { if (isMissing(error)) throw new AppError(404, 'TRAIN_NOT_FOUND', 'Train was not found.'); throw error } },
  async seats(id: string, date: string) {
    const train = await this.get(id)
    const journeyDate = new Date(`${date}T00:00:00.000Z`)
    const seats = await prisma.seat.findMany({ where: { coach: { trainId: id } }, include: { coach: { select: { coachNumber: true, coachType: true } }, allocations: { where: { journeyDate }, select: { status: true, heldUntil: true } } }, orderBy: [{ coach: { coachNumber: 'asc' } }, { seatNumber: 'asc' }] })
    return { train: { id: train.id, trainNumber: train.trainNumber, trainName: train.trainName }, journeyDate: date, seats: seats.map(s => ({ coach: s.coach.coachNumber, coachType: s.coach.coachType, seatNumber: s.seatNumber, seatType: s.seatType, status: s.allocations.some(a => a.status === 'BOOKED' || (a.status === 'HELD' && a.heldUntil && a.heldUntil > new Date())) ? 'UNAVAILABLE' : 'AVAILABLE' })) }
  },
}
function isMissing(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025' }
