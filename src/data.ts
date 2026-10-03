export type Train = { id: string; dbId?:string; name: string; from: string; to: string; depart: string; arrive: string; duration: string; seats: number; fare: number }
export type Booking = { id?: string; pnr: string; name: string; age: number; contact: string; train: string; coach: string; seat: string; date: string; status: 'Confirmed' | 'Waiting' | 'Cancelled' | 'Pending' | 'Failed'; preference?: string; paymentMethod?:string }
export type MedicalRequest = { id: string; pnr: string; coach: string; seat: string; details: string; priority: 'High' | 'Medium' | 'Normal'; status: string }
export const trains: Train[] = [
  { id: '12951', name: 'Mumbai Rajdhani', from: 'Mumbai Central', to: 'New Delhi', depart: '16:35', arrive: '08:35', duration: '16h 00m', seats: 42, fare: 2145 },
  { id: '12009', name: 'Shatabdi Express', from: 'Mumbai Central', to: 'Ahmedabad', depart: '06:25', arrive: '12:45', duration: '6h 20m', seats: 18, fare: 980 },
  { id: '12123', name: 'Deccan Queen', from: 'Mumbai CSMT', to: 'Pune Jn', depart: '17:10', arrive: '20:25', duration: '3h 15m', seats: 27, fare: 640 },
  { id: '12617', name: 'Mangala Lakshadweep', from: 'Mumbai LTT', to: 'Bengaluru', depart: '08:35', arrive: '06:10', duration: '21h 35m', seats: 9, fare: 1570 },
]
export const initialBookings: Booking[] = [
  { pnr: 'SR458921', name: 'Aarav Mehta', age: 28, contact: '••••• 4218', train: '12951 · Mumbai Rajdhani', coach: 'B2', seat: '36', date: '2026-10-06', status: 'Confirmed' },
  { pnr: 'SR173604', name: 'Mira Shah', age: 34, contact: '••••• 9081', train: '12009 · Shatabdi Express', coach: 'C1', seat: '12', date: '2026-10-06', status: 'Confirmed' },
  { pnr: 'SR920147', name: 'Kabir Rao', age: 22, contact: '••••• 6652', train: '12123 · Deccan Queen', coach: '—', seat: '—', date: '2026-10-07', status: 'Waiting' },
  { pnr: 'SR308516', name: 'Anaya Desai', age: 41, contact: '••••• 1129', train: '12951 · Mumbai Rajdhani', coach: 'A1', seat: '08', date: '2026-10-07', status: 'Confirmed' },
]
export const initialMedical: MedicalRequest[] = [
  { id: 'MED-041', pnr: 'SR458921', coach: 'B2', seat: '36', details: 'Passenger feeling unwell', priority: 'High', status: 'Support notified' },
  { id: 'MED-038', pnr: 'SR173604', coach: 'C1', seat: '12', details: 'Mobility assistance at arrival', priority: 'Medium', status: 'Acknowledged' },
]
