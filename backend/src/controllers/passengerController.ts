import { passengerService } from '../services/passengerService.js'
import { asyncHandler, ok } from '../utils/http.js'

export const list=asyncHandler(async(req,res)=>ok(res,await passengerService.list(req.user!.id,req.user!.role)))
export const get=asyncHandler(async(req,res)=>ok(res,await passengerService.get(String(req.params.id),req.user!.id,req.user!.role)))
export const create=asyncHandler(async(req,res)=>ok(res,await passengerService.create(req.body,req.user!.id),201))
export const update=asyncHandler(async(req,res)=>ok(res,await passengerService.update(String(req.params.id),req.body,req.user!.id,req.user!.role)))
