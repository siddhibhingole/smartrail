import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

export const validate = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const parsed = schema.parse({ body: req.body, query: req.query, params: req.params }) as { body?: unknown }
  req.body = parsed.body ?? req.body
  next()
}
