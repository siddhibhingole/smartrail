import { Prisma } from '@prisma/client'
import type { TravelClass } from '../domain/travelClass.js'
import { prisma } from '../config/prisma.js'
import { trainService } from '../services/trainService.js'
import { seatService } from '../services/seatService.js'
import { asyncHandler, AppError, ok } from '../utils/http.js'

export const list = asyncHandler(async (req,res) => ok(res, await trainService.list({ from: String(req.query.from ?? ''), to: String(req.query.to ?? ''), q: String(req.query.q ?? '') })))
export const get = asyncHandler(async (req,res) => ok(res, await trainService.get(String(req.params.id))))
export const create = asyncHandler(async (req,res) => { const train = await trainService.create(req.body); await prisma.auditLog.create({ data: { userId:req.user!.id, action:'TRAIN_CREATED', entity:'Train', entityId:train.id } }); ok(res, train, 201) })
export const update = asyncHandler(async (req,res) => ok(res, await trainService.update(String(req.params.id), req.body)))
export const remove = asyncHandler(async (req,res) => ok(res, await trainService.remove(String(req.params.id))))
export const seats = asyncHandler(async (req,res) => { if (!req.query.date || typeof req.query.date !== 'string') throw new AppError(400,'DATE_REQUIRED','A journey date is required.'); const travelClass=typeof req.query.travelClass==='string'?req.query.travelClass:'ALL'; if(!['ALL','1A','2A','3A','SL','CC'].includes(travelClass))throw new AppError(400,'INVALID_TRAVEL_CLASS','Choose a supported travel class.'); ok(res, await trainService.seats(String(req.params.id),req.query.date,travelClass as TravelClass)) })
export const hold = asyncHandler(async (req,res) => {
  const date = new Date(`${req.body.journeyDate}T00:00:00.000Z`)
  const result = await prisma.$transaction(async tx => {
    const train = await tx.train.findUnique({ where:{id:req.body.trainId}, select:{id:true} })
    if (!train) throw new AppError(404,'TRAIN_NOT_FOUND','Train was not found.')
    const seats = await seatService.available(tx,train.id,date,req.body.passengerCount,req.body.seatPreference,req.body.seatIds,req.body.groupBooking,req.body.travelClass)
    if (req.body.seatIds && seats.length < req.body.seatIds.length) throw new AppError(409,'SEAT_UNAVAILABLE','One or more selected seats are no longer available.')
    if (seats.length < req.body.passengerCount) throw new AppError(409,'SEAT_UNAVAILABLE','There are not enough seats for this request.')
    const holdInfo = await seatService.hold(tx,seats,date)
    return { ...holdInfo, allocationStatus: seats.length===req.body.passengerCount?(req.body.groupBooking?'GROUP_ALLOCATED':'ALLOCATED'):'PARTIAL', seats: seats.map(s=>({coach:s.coachNumber,seatNumber:s.seatNumber,seatType:s.seatType,allocationReason:req.body.seatPreference===s.seatType?'Preference matched':req.body.groupBooking?'Same coach / nearby seats':'Best available seat'})) }
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
  ok(res,result,201)
})
export const release = asyncHandler(async (req,res) => {
  const released = await prisma.seatAllocation.deleteMany({ where:{holdToken:req.body.holdToken,status:'HELD'} })
  if (!released.count) throw new AppError(404,'HOLD_NOT_FOUND','An active hold for this token was not found.')
  ok(res,{released:released.count})
})
