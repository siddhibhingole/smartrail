import { MedicalPriority } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/http.js'

const priorities: Record<MedicalPriority, number> = { HIGH: 0, MEDIUM: 1, NORMAL: 2 }
export const medicalService = {
  async create(userId: string, role: string, data: { pnr: string; coach: string; seat: string; condition: string; contact?: string; priority: MedicalPriority }) {
    const booking = await prisma.booking.findUnique({ where: { pnr: data.pnr }, select: { id: true, userId: true } })
    if (!booking) throw new AppError(404, 'PNR_NOT_FOUND', 'No booking was found for this PNR.')
    if (role === 'PASSENGER' && booking.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You cannot request assistance for this booking.')
    const request = await prisma.medicalRequest.create({ data: { ...data, userId, priority: data.priority } })
    await prisma.auditLog.create({ data: { userId, action: 'MEDICAL_REQUEST_CREATED', entity: 'MedicalRequest', entityId: request.id } })
    return request
  },
  async list(userId: string, role: string) { const items = await prisma.medicalRequest.findMany({ where: role === 'PASSENGER' ? { userId } : {}, orderBy: { createdAt: 'asc' } }); return items.sort((a,b) => priorities[a.priority]-priorities[b.priority] || a.createdAt.getTime()-b.createdAt.getTime()) },
  async update(id: string, data: { priority?: MedicalPriority; status?: 'REQUESTED'|'ACKNOWLEDGED'|'RESOLVED' }, userId: string) { const request = await prisma.medicalRequest.update({ where: { id }, data }); await prisma.auditLog.create({ data: { userId, action: 'MEDICAL_REQUEST_UPDATED', entity: 'MedicalRequest', entityId: id, metadata: data } }); return request },
}
