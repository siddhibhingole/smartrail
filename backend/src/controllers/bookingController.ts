import { bookingService } from '../services/bookingService.js'
import { asyncHandler, ok } from '../utils/http.js'

export const create = asyncHandler(async(req,res)=>ok(res,await bookingService.create(req.user!.id,req.body),201))
export const list = asyncHandler(async(req,res)=>ok(res,await bookingService.list(req.user!.id,req.user!.role)))
export const get = asyncHandler(async(req,res)=>ok(res,await bookingService.get(req.user!.id,req.user!.role,String(req.params.id))))
export const byPnr = asyncHandler(async(req,res)=>ok(res,await bookingService.pnrLookup(String(req.params.pnr),req.user!.id,req.user!.role)))
export const cancel = asyncHandler(async(req,res)=>ok(res,await bookingService.cancel(req.user!.id,req.user!.role,String(req.params.id))))
