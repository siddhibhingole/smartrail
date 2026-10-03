import { PaymentStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'

export type MockPaymentResult = { status: PaymentStatus; reference: string }
export function processMockPayment(): MockPaymentResult {
  const roll = Math.random()
  const pending = Math.min(env.MOCK_PAYMENT_PENDING_RATE, 1 - env.MOCK_PAYMENT_SUCCESS_RATE)
  if (roll < env.MOCK_PAYMENT_SUCCESS_RATE) return { status: PaymentStatus.SUCCESS, reference: `MOCK-${randomUUID()}` }
  if (roll < env.MOCK_PAYMENT_SUCCESS_RATE + pending) return { status: PaymentStatus.PENDING, reference: `MOCK-${randomUUID()}` }
  return { status: PaymentStatus.FAILED, reference: `MOCK-${randomUUID()}` }
}
export function refundMockPayment(): PaymentStatus { return Math.random() < env.MOCK_PAYMENT_SUCCESS_RATE ? PaymentStatus.REFUNDED : PaymentStatus.PENDING }
