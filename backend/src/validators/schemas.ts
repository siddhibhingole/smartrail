import { z } from 'zod'

const seatTypes = ['WINDOW', 'MIDDLE', 'AISLE'] as const
const paymentMethods = ['UPI', 'CARD', 'NET_BANKING', 'WALLET', 'CASH'] as const
const isoDate = z.string().date()
const passengerInput = z.object({ fullName: z.string().trim().min(2).max(120), age: z.number().int().min(1).max(120), gender: z.enum(['FEMALE','MALE','NON_BINARY','UNDISCLOSED']).default('UNDISCLOSED'), phone: z.string().regex(/^\+?[0-9 -]{7,20}$/).optional(), idType: z.string().max(40).optional(), idNumber: z.string().max(100).optional(), seatPreference: z.enum(seatTypes).optional() })
export const registerSchema = z.object({ body: z.object({ name: z.string().trim().min(2).max(100), email: z.email(), phone: z.string().regex(/^\+?[0-9 -]{7,20}$/).optional(), password: z.string().min(8).max(100) }) })
export const loginSchema = z.object({ body: z.object({ email: z.email(), password: z.string().min(1) }) })
export const bookingSchema = z.object({ body: z.object({ trainId: z.string().min(1), journeyDate: isoDate, passengers: z.array(passengerInput).min(1).max(8), seatPreference: z.enum(seatTypes).optional(), seatIds: z.array(z.string().min(1)).min(1).max(8).optional(), groupBooking: z.boolean().default(false), paymentMethod: z.enum(paymentMethods), idempotencyKey: z.string().min(8).max(128) }).refine(v=>!v.seatIds||v.seatIds.length===v.passengers.length,'Each passenger must have one requested seat.') })
export const holdSchema = z.object({ body: z.object({ trainId: z.string().min(1), journeyDate: isoDate, passengerCount: z.number().int().min(1).max(8), seatPreference: z.enum(seatTypes).optional(), seatIds: z.array(z.string().min(1)).min(1).max(8).optional(), groupBooking: z.boolean().default(false) }) })
export const medicalSchema = z.object({ body: z.object({ pnr: z.string().regex(/^SR[0-9]{6}$/i), coach: z.string().min(1).max(10), seat: z.string().min(1).max(8), condition: z.string().trim().min(3).max(1000), contact: z.string().regex(/^\+?[0-9 -]{7,20}$/).optional(), priority: z.enum(['HIGH','MEDIUM','NORMAL']).default('NORMAL') }) })
export const trainSearchSchema = z.object({ query: z.object({ from: z.string().optional(), to: z.string().optional(), date: isoDate.optional(), q: z.string().optional() }) })
export const trainSchema = z.object({ body: z.object({ trainNumber: z.string().trim().min(2).max(12), trainName: z.string().trim().min(2).max(120), source: z.string().trim().min(2).max(120), destination: z.string().trim().min(2).max(120), departureTime: z.string().regex(/^\d{2}:\d{2}$/), arrivalTime: z.string().regex(/^\d{2}:\d{2}$/), duration: z.string().min(2).max(30), baseFare: z.number().positive().max(100000) }) })
export const partialTrainSchema = z.object({ body: trainSchema.shape.body.partial().refine(v=>Object.keys(v).length>0,'At least one field is required.') })
export const holdReleaseSchema = z.object({ body: z.object({ holdToken: z.uuid() }) })
export const passengerSchema = z.object({ body: z.object({ fullName:z.string().trim().min(2).max(120),age:z.number().int().min(1).max(120),gender:z.enum(['FEMALE','MALE','NON_BINARY','UNDISCLOSED']).default('UNDISCLOSED'),phone:z.string().regex(/^\+?[0-9 -]{7,20}$/).optional(),idType:z.string().max(40).optional(),idNumber:z.string().max(100).optional() }) })
export const partialPassengerSchema = z.object({ body: passengerSchema.shape.body.partial().refine(v=>Object.keys(v).length>0,'At least one field is required.') })
export const medicalUpdateSchema = z.object({ body: z.object({ priority:z.enum(['HIGH','MEDIUM','NORMAL']).optional(),status:z.enum(['REQUESTED','ACKNOWLEDGED','RESOLVED']).optional() }).refine(v=>Object.keys(v).length>0,'At least one field is required.') })
export const waitingSchema = z.object({ body: z.object({ bookingId:z.string().min(1) }) })
export const paymentSchema = z.object({ body: z.object({ bookingId:z.string().min(1) }) })
export const idParamSchema = z.object({ params: z.object({ id:z.string().min(1) }) })
