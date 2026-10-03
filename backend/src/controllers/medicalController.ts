import { MedicalPriority } from '@prisma/client'
import { medicalService } from '../services/medicalService.js'
import { asyncHandler, ok } from '../utils/http.js'

export const create=asyncHandler(async(req,res)=>ok(res,await medicalService.create(req.user!.id,req.user!.role,req.body),201))
export const list=asyncHandler(async(req,res)=>ok(res,await medicalService.list(req.user!.id,req.user!.role)))
export const update=asyncHandler(async(req,res)=>ok(res,await medicalService.update(String(req.params.id),{...(req.body.priority?{priority:req.body.priority as MedicalPriority}:{}),...(req.body.status?{status:req.body.status}:{})},req.user!.id)))
