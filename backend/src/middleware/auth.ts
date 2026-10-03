import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { env } from '../config/env.js'
import { AppError } from '../utils/http.js'

type TokenPayload = { sub: string; role: Role }
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'))
  try { const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload; req.user = { id: payload.sub, role: payload.role }; next() }
  catch { next(new AppError(401, 'INVALID_TOKEN', 'Your session is invalid or expired.')) }
}

export const allowRoles = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this operation.'))
  next()
}
