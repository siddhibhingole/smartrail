export type TravelClass = 'ALL' | '1A' | '2A' | '3A' | 'SL' | 'CC'

const aliases: Record<Exclude<TravelClass, 'ALL'>, readonly string[]> = {
  '1A': ['1A', 'AC 1 Tier', 'First AC', 'AC First Class'],
  '2A': ['2A', 'AC 2 Tier', 'Second AC'],
  '3A': ['3A', 'AC 3 Tier', 'Third AC'],
  SL: ['SL', 'Sleeper', 'Sleeper Class'],
  CC: ['CC', 'Chair Car', 'AC Chair Car'],
}

export function coachTypesForClass(travelClass: TravelClass): string[] | undefined {
  return travelClass === 'ALL' ? undefined : [...aliases[travelClass]]
}
