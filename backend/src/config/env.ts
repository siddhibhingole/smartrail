import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  MOCK_PAYMENT_SUCCESS_RATE: z.coerce.number().min(0).max(1).default(0.9),
  MOCK_PAYMENT_PENDING_RATE: z.coerce.number().min(0).max(1).default(0.05),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export const env = envSchema.parse(process.env)
