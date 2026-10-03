import { prisma } from '../config/prisma.js'

export const trainRepository = {
  list: (q?: { from?: string; to?: string; search?: string }) => prisma.train.findMany({ where: { ...(q?.from ? { source: { contains: q.from, mode: 'insensitive' } } : {}), ...(q?.to ? { destination: { contains: q.to, mode: 'insensitive' } } : {}), ...(q?.search ? { OR: [{ trainName: { contains: q.search, mode: 'insensitive' } }, { trainNumber: { contains: q.search } }] } : {}) }, include: { coaches: { include: { _count: { select: { seats: true } } } } }, orderBy: { trainNumber: 'asc' } }),
  byId: (id: string) => prisma.train.findUnique({ where: { id }, include: { coaches: { include: { seats: true } } } }),
}
