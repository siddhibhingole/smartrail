import { prisma } from '../config/prisma.js'

export const analyticsService = {
  async occupancy() {
    const [physicalSeats, occupied, held, confirmedBookings, waitingPassengers, activeJourneyDates] = await Promise.all([
      prisma.seat.count(), prisma.seatAllocation.count({ where: { status: 'BOOKED' } }), prisma.seatAllocation.count({ where: { status: 'HELD', heldUntil: { gt: new Date() } } }),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }), prisma.waitingList.count({ where: { status: 'WAITING' } }),
      prisma.booking.findMany({ where: { status: { in: ['CONFIRMED', 'PENDING', 'WAITING'] } }, distinct: ['journeyDate'], select: { journeyDate: true } }),
    ])
    const tripCount=Math.max(1,activeJourneyDates.length)
    const totalSeats=physicalSeats*tripCount
    const available = Math.max(0, totalSeats - occupied - held)
    return { totalSeats, occupiedSeats: occupied, heldSeats: held, availableSeats: available, waitingPassengers, confirmedBookings, occupancyPercent: totalSeats ? Number((occupied / totalSeats * 100).toFixed(1)) : 0 }
  },
  async bookings() { const [total, confirmed, cancelled, waiting, failed, grouped] = await Promise.all([prisma.booking.count(),prisma.booking.count({where:{status:'CONFIRMED'}}),prisma.booking.count({where:{status:'CANCELLED'}}),prisma.booking.count({where:{status:'WAITING'}}),prisma.booking.count({where:{status:'FAILED'}}),prisma.booking.groupBy({by:['status'],_count:{_all:true}})]); return { total, confirmed, cancelled, waiting, failed, byStatus: grouped.map(x => ({status:x.status,count:x._count._all})) } },
  async revenue() { const [payments, refunds] = await Promise.all([prisma.transaction.aggregate({where:{type:'BOOKING',status:'SUCCESS'},_sum:{amount:true}}),prisma.transaction.aggregate({where:{type:'REFUND',status:'SUCCESS'},_sum:{amount:true}})]); return { revenue: payments._sum.amount ?? 0, refunds: refunds._sum.amount ?? 0 } },
}
