import type { NextFunction, Request, RequestHandler, Response } from 'express'

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { void fn(req, res, next).catch(next) }

export const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data })

export const audit = (userId: string | null, action: string, entity: string, entityId: string | null, metadata?: object) =>
  prismaAudit(userId, action, entity, entityId, metadata)

import { prisma } from '../config/prisma.js'
function prismaAudit(userId: string | null, action: string, entity: string, entityId: string | null, metadata?: object) {
  return prisma.auditLog.create({ data: { userId, action, entity, entityId, metadata: metadata as object | undefined } })
}
