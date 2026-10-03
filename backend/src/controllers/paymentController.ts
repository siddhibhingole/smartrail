import { AllocationStatus, BookingStatus, PaymentStatus, Prisma, TransactionStatus } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { processMockPayment } from '../services/paymentService.js'
import { AppError, asyncHandler, ok } from '../utils/http.js'

export const process = asyncHandler(async (req,res) => {
  const result = await prisma.$transaction(async tx => {
    const payment = await tx.payment.findUnique({ where: { bookingId: req.body.bookingId }, include: { booking: { include: { passengers: { orderBy: { position: 'asc' } } } } } })
    if (!payment) throw new AppError(404,'PAYMENT_NOT_FOUND','Payment was not found.')
    if (req.user!.role==='PASSENGER' && payment.booking.userId!==req.user!.id) throw new AppError(403,'FORBIDDEN','You cannot process this payment.')
    if (payment.status===PaymentStatus.SUCCESS || payment.status===PaymentStatus.FAILED) return {payment,bookingStatus:payment.booking.status}
    const heldSeatIds=payment.booking.passengers.flatMap(p=>p.seatId?[p.seatId]:[])
    const currentHolds=await tx.seatAllocation.findMany({where:{seatId:{in:heldSeatIds},journeyDate:payment.booking.journeyDate,status:'HELD',heldUntil:{gt:new Date()}}})
    if(payment.status===PaymentStatus.PENDING&&currentHolds.length!==payment.booking.passengers.length){
      await tx.payment.update({where:{id:payment.id},data:{status:PaymentStatus.FAILED}})
      await tx.transaction.updateMany({where:{bookingId:payment.bookingId,type:'BOOKING'},data:{status:TransactionStatus.FAILED}})
      await tx.booking.update({where:{id:payment.bookingId},data:{status:BookingStatus.FAILED}})
      await tx.seatAllocation.deleteMany({where:{seatId:{in:heldSeatIds},journeyDate:payment.booking.journeyDate,status:'HELD'}})
      return {payment:{...payment,status:PaymentStatus.FAILED},bookingStatus:BookingStatus.FAILED,reason:'SEAT_HOLD_EXPIRED'}
    }
    const outcome=processMockPayment()
    await tx.payment.update({where:{id:payment.id},data:{status:outcome.status,gatewayReference:outcome.reference}})
    const transactionStatus=outcome.status===PaymentStatus.SUCCESS?TransactionStatus.SUCCESS:outcome.status===PaymentStatus.FAILED?TransactionStatus.FAILED:TransactionStatus.PROCESSING
    await tx.transaction.updateMany({where:{bookingId:payment.bookingId,type:'BOOKING'},data:{status:transactionStatus}})
    if(outcome.status===PaymentStatus.SUCCESS){
      const allocations=currentHolds
      for(const [index,allocation] of allocations.entries())await tx.seatAllocation.update({where:{id:allocation.id},data:{status:AllocationStatus.BOOKED,holdToken:null,heldUntil:null,bookingPassengerId:payment.booking.passengers[index]!.id}})
      await tx.booking.update({where:{id:payment.bookingId},data:{status:BookingStatus.CONFIRMED}})
      await tx.undoTransaction.create({data:{userId:req.user!.id,transactionId:(await tx.transaction.findFirstOrThrow({where:{bookingId:payment.bookingId,type:'BOOKING'}})).id,operation:'BOOKING',payload:{bookingId:payment.bookingId}}})
      await tx.auditLog.create({data:{userId:req.user!.id,action:'PAYMENT_SUCCESS',entity:'Payment',entityId:payment.id}})
    }else if(outcome.status===PaymentStatus.FAILED){
      await tx.seatAllocation.deleteMany({where:{seatId:{in:payment.booking.passengers.flatMap(p=>p.seatId?[p.seatId]:[])},journeyDate:payment.booking.journeyDate,status:'HELD'}})
      await tx.booking.update({where:{id:payment.bookingId},data:{status:BookingStatus.FAILED}})
      await tx.auditLog.create({data:{userId:req.user!.id,action:'PAYMENT_FAILED',entity:'Payment',entityId:payment.id}})
    }
    return {payment:{...payment,status:outcome.status,gatewayReference:outcome.reference},bookingStatus:outcome.status===PaymentStatus.SUCCESS?'CONFIRMED':outcome.status===PaymentStatus.FAILED?'FAILED':'PENDING'}
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
  ok(res,result)
})

export const get = asyncHandler(async(req,res)=>{
  const payment=await prisma.payment.findUnique({where:{id:String(req.params.id)},include:{booking:{select:{userId:true,pnr:true,status:true}},transaction:{select:{referenceId:true,status:true}}}})
  if(!payment)throw new AppError(404,'PAYMENT_NOT_FOUND','Payment was not found.')
  if(req.user!.role==='PASSENGER'&&payment.booking.userId!==req.user!.id)throw new AppError(403,'FORBIDDEN','You cannot view this payment.')
  ok(res,payment)
})
