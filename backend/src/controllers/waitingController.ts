import { BookingStatus, Prisma, TransactionStatus, TransactionType, WaitingStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { prisma } from '../config/prisma.js'
import { seatService } from '../services/seatService.js'
import { AppError, asyncHandler, ok } from '../utils/http.js'

export const list=asyncHandler(async(req,res)=>{
 const rows=await prisma.waitingList.findMany({where:{...(req.user!.role==='PASSENGER'?{booking:{userId:req.user!.id}}:{})},include:{booking:{select:{id:true,pnr:true,status:true,journeyDate:true,train:{select:{trainNumber:true,trainName:true}},passengers:{select:{passenger:{select:{fullName:true,age:true}}}}}}},orderBy:[{status:'asc'},{createdAt:'asc'},{position:'asc'}]})
 ok(res,rows)
})
export const join=asyncHandler(async(req,res)=>{
 const row=await prisma.$transaction(async tx=>{
  const booking=await tx.booking.findUnique({where:{id:req.body.bookingId},include:{passengers:true}})
  if(!booking)throw new AppError(404,'BOOKING_NOT_FOUND','Booking not found.')
  if(req.user!.role==='PASSENGER'&&booking.userId!==req.user!.id)throw new AppError(403,'FORBIDDEN','You cannot update this booking.')
  if(booking.status!=='PENDING'&&booking.status!=='FAILED')throw new AppError(409,'INVALID_BOOKING_STATE','Only pending or failed bookings can enter the waiting list.')
  const max=await tx.waitingList.aggregate({where:{status:WaitingStatus.WAITING},_max:{position:true}})
  await tx.booking.update({where:{id:booking.id},data:{status:BookingStatus.WAITING}})
  return tx.waitingList.create({data:{bookingId:booking.id,position:(max._max.position??0)+1}})
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
 ok(res,row,201)
})
export const promote=asyncHandler(async(req,res)=>{
 const result=await prisma.$transaction(async tx=>{
  const entry=await tx.waitingList.findUnique({where:{id:String(req.params.id)},include:{booking:{include:{passengers:true}}}})
  if(!entry||entry.status!==WaitingStatus.WAITING)throw new AppError(404,'WAITING_ENTRY_NOT_FOUND','Active waiting-list entry not found.')
  const success=await seatService.reserveForWaiting(tx,entry.booking.trainId,entry.booking.journeyDate,entry.bookingId,entry.booking.passengers.map(p=>p.passengerId))
  if(!success)throw new AppError(409,'SEAT_UNAVAILABLE','There are not enough seats to promote this booking.')
  await tx.booking.update({where:{id:entry.bookingId},data:{status:BookingStatus.CONFIRMED}})
  await tx.waitingList.update({where:{id:entry.id},data:{status:WaitingStatus.PROMOTED,promotedAt:new Date()}})
  await tx.transaction.create({data:{userId:req.user!.id,bookingId:entry.bookingId,type:TransactionType.WAITING_LIST_PROMOTION,status:TransactionStatus.SUCCESS,amount:entry.booking.totalAmount,referenceId:`TX-${randomUUID()}`}})
  await tx.auditLog.create({data:{userId:req.user!.id,action:'WAITING_LIST_PROMOTED',entity:'Booking',entityId:entry.bookingId}})
  return {bookingId:entry.bookingId,pnr:entry.booking.pnr,status:BookingStatus.CONFIRMED}
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
 ok(res,result)
})
