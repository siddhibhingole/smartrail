import { prisma } from '../config/prisma.js'
import { AppError, asyncHandler, ok } from '../utils/http.js'

export const process = asyncHandler(async (req, _res) => {
  const payment = await prisma.payment.findUnique({ where: { bookingId: req.body.bookingId }, include: { booking: { select: { userId: true } } } })
  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment was not found.')
  if (req.user!.role === 'PASSENGER' && payment.booking.userId !== req.user!.id) throw new AppError(403, 'FORBIDDEN', 'You cannot process this payment.')
  throw new AppError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'No payment provider is configured. The reservation remains pending.')
})

export const get = asyncHandler(async(req,res)=>{
  const payment=await prisma.payment.findUnique({where:{id:String(req.params.id)},include:{booking:{select:{userId:true,pnr:true,status:true}},transaction:{select:{referenceId:true,status:true}}}})
  if(!payment)throw new AppError(404,'PAYMENT_NOT_FOUND','Payment was not found.')
  if(req.user!.role==='PASSENGER'&&payment.booking.userId!==req.user!.id)throw new AppError(403,'FORBIDDEN','You cannot view this payment.')
  ok(res,payment)
})
