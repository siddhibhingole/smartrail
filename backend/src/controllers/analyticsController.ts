import { analyticsService } from '../services/analyticsService.js'
import { asyncHandler, ok } from '../utils/http.js'

export const occupancy=asyncHandler(async(_req,res)=>ok(res,await analyticsService.occupancy()))
export const bookings=asyncHandler(async(_req,res)=>ok(res,await analyticsService.bookings()))
export const revenue=asyncHandler(async(_req,res)=>ok(res,await analyticsService.revenue()))
