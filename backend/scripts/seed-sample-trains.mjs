import 'dotenv/config'
import { PrismaClient, SeatType } from '@prisma/client'

const prisma = new PrismaClient()

const services = [
  { number: 'SR1001', name: 'North Express', source: 'New Delhi', destination: 'Mumbai Central', departure: '06:15', arrival: '22:30', duration: '16h 15m', fare: 1450, originCode: 'NDLS', destinationCode: 'MMCT', originCity: 'Delhi', destinationCity: 'Mumbai' },
  { number: 'SR1002', name: 'Southern Express', source: 'Chennai Central', destination: 'Bengaluru City', departure: '07:10', arrival: '13:40', duration: '6h 30m', fare: 680, originCode: 'MAS', destinationCode: 'SBC', originCity: 'Chennai', destinationCity: 'Bengaluru' },
  { number: 'SR1003', name: 'Eastern Express', source: 'Howrah Junction', destination: 'Patna Junction', departure: '08:00', arrival: '17:25', duration: '9h 25m', fare: 920, originCode: 'HWH', destinationCode: 'PNBE', originCity: 'Kolkata', destinationCity: 'Patna' },
  { number: 'SR1004', name: 'Coastal Express', source: 'Mumbai CSMT', destination: 'Madgaon', departure: '06:00', arrival: '18:15', duration: '12h 15m', fare: 1100, originCode: 'CSMT', destinationCode: 'MAO', originCity: 'Mumbai', destinationCity: 'Madgaon' },
]

const classes = ['1A', '2A', '3A', 'SL', 'CC']
const seatTypes = [SeatType.WINDOW, SeatType.MIDDLE, SeatType.AISLE, SeatType.MIDDLE]

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Sample train data is disabled in production.')

  for (const service of services) {
    const origin = await prisma.station.upsert({ where: { code: service.originCode }, update: {}, create: { code: service.originCode, name: service.source, city: service.originCity } })
    const destination = await prisma.station.upsert({ where: { code: service.destinationCode }, update: {}, create: { code: service.destinationCode, name: service.destination, city: service.destinationCity } })
    const existing = await prisma.train.findUnique({ where: { trainNumber: service.number }, select: { id: true } })
    if (existing) {
      await prisma.train.update({ where: { id: existing.id }, data: { trainName: service.name } })
      continue
    }

    await prisma.train.create({
      data: {
        trainNumber: service.number,
        trainName: service.name,
        source: service.source,
        destination: service.destination,
        departureTime: service.departure,
        arrivalTime: service.arrival,
        duration: service.duration,
        baseFare: service.fare,
        routes: { create: [
          { stationId: origin.id, stopOrder: 1, departureTime: service.departure },
          { stationId: destination.id, stopOrder: 2, arrivalTime: service.arrival },
        ] },
        coaches: { create: classes.map(coachType => ({
          coachNumber: coachType,
          coachType,
          capacity: 8,
          seats: { create: Array.from({ length: 8 }, (_, index) => ({ seatNumber: String(index + 1), seatType: seatTypes[index % seatTypes.length] })) },
        })) },
      },
    })
    console.info(`Added ${service.number}: ${service.source} to ${service.destination}.`)
  }
}

main().catch(error => {
  console.error('Sample train provisioning failed:', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
