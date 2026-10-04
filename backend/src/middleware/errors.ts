import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AppError } from '../utils/http.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) return void res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } })
  if (error instanceof ZodError) return void res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) } })
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const conflict = error.code === 'P2002' || error.code === 'P2034'
    return void res.status(conflict ? 409 : 400).json({ success: false, error: { code: conflict ? 'CONFLICT' : 'DATABASE_ERROR', message: conflict ? 'The requested resource conflicts with an existing operation.' : 'The database rejected the request.' } })
  }
  if (error instanceof Prisma.PrismaClientInitializationError || (typeof error === 'object' && error !== null && 'errorCode' in error && error.errorCode === 'P1001')) {
    console.warn('Database is unavailable for this request.')
    return void res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable. Check the database connection and try again.' } })
  }
  console.error('Unhandled request error', error instanceof Error ? error.name : 'unknown')
  return void res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } })
}
