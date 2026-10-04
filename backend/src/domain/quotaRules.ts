export type ReservationQuota = 'GENERAL' | 'TATKAL' | 'LADIES' | 'SENIOR_CITIZEN'

export type QuotaPolicy = {
  fareMultiplier: number
  maxPassengers: number
}

const policies: Record<ReservationQuota, QuotaPolicy> = {
  GENERAL: { fareMultiplier: 1, maxPassengers: 8 },
  TATKAL: { fareMultiplier: 1.3, maxPassengers: 4 },
  LADIES: { fareMultiplier: 1, maxPassengers: 8 },
  SENIOR_CITIZEN: { fareMultiplier: 1, maxPassengers: 8 },
}

export function getQuotaPolicy(quota: ReservationQuota = 'GENERAL'): QuotaPolicy {
  return policies[quota]
}

export function calculateQuotaFare(baseFare: number, passengerCount: number, quota: ReservationQuota = 'GENERAL') {
  const policy = getQuotaPolicy(quota)
  if (!Number.isFinite(baseFare) || baseFare < 0) throw new RangeError('Base fare must be a non-negative number.')
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > policy.maxPassengers) throw new RangeError(`This quota allows up to ${policy.maxPassengers} passengers per booking.`)
  return Math.round(baseFare * policy.fareMultiplier * passengerCount * 100) / 100
}
