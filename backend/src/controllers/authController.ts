import { authService } from '../services/authService.js'
import { asyncHandler, ok } from '../utils/http.js'

export const register = asyncHandler(async (req,res) => ok(res, await authService.register(req.body), 201))
export const login = asyncHandler(async (req,res) => ok(res, await authService.login(req.body.email, req.body.password)))
export const me = asyncHandler(async (req,res) => ok(res, await authService.me(req.user!.id)))
