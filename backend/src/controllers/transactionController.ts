import { transactionService } from '../services/transactionService.js'
import { asyncHandler, ok } from '../utils/http.js'

export const list=asyncHandler(async(req,res)=>ok(res,await transactionService.list(req.user!.id,req.user!.role,{type:String(req.query.type||'')||undefined,status:String(req.query.status||'')||undefined,bookingId:String(req.query.bookingId||'')||undefined,from:String(req.query.from||'')||undefined,to:String(req.query.to||'')||undefined})))
export const get=asyncHandler(async(req,res)=>ok(res,await transactionService.get(String(req.params.id),req.user!.id,req.user!.role)))
export const undo=asyncHandler(async(req,res)=>ok(res,await transactionService.undo(req.user!.id)))
