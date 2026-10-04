export type SeatCandidate = { id: string; coachId: string; seatNumber: string }

export function isContiguousGroup(seats: SeatCandidate[]) {
  if (seats.length < 2) return true
  const coachId = seats[0]!.coachId
  const numbers = seats.map(seat => Number(seat.seatNumber)).sort((a, b) => a - b)
  return seats.every(seat => seat.coachId === coachId) && numbers.every((number, index) => index === 0 || number === numbers[index - 1]! + 1)
}

export function findContiguousGroup<T extends SeatCandidate>(seats: T[], count: number): T[] | null {
  if (!Number.isInteger(count) || count < 1) return null
  const coaches = [...new Set(seats.map(seat => seat.coachId))]
  for (const coachId of coaches) {
    const ordered = seats.filter(seat => seat.coachId === coachId).sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber))
    for (let start = 0; start <= ordered.length - count; start++) {
      const block = ordered.slice(start, start + count)
      if (isContiguousGroup(block)) return block
    }
  }
  return null
}
