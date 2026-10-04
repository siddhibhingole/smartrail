import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Users } from 'lucide-react'
import type { Booking, Train } from '../data'
import { trainService } from '../services/api'
import type { TravelClass } from '../services/api'

type Quota = 'GENERAL' | 'TATKAL' | 'LADIES' | 'SENIOR_CITIZEN'
type Passenger = { name: string; age: number }
type Input = { train: string; date: string; passengers: Passenger[]; preference: string; travelClass: TravelClass; quota: Quota }

export function GroupBookingCheckout({ onCreate }: { onCreate: (input: Input) => Promise<{ booking: Booking; count: number; seats: string[] }> }) {
  const [trains, setTrains] = useState<Train[]>([])
  const [train, setTrain] = useState('')
  const [date, setDate] = useState('')
  const [travelClass, setTravelClass] = useState<TravelClass>('ALL')
  const [quota, setQuota] = useState<Quota>('GENERAL')
  const [size, setSize] = useState(3)
  const [passengers, setPassengers] = useState<Passenger[]>([{ name: '', age: 25 }, { name: '', age: 25 }, { name: '', age: 25 }])
  const [preference, setPreference] = useState('No preference')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ booking: Booking; count: number; seats: string[] } | null>(null)
  const maxPassengers = quota === 'TATKAL' ? 4 : 8
  const selectedTrain = useMemo(() => trains.find(item => item.id === train.split(' · ')[0]), [trains, train])
  const baseFare = selectedTrain?.fare ?? 0
  const surcharge = quota === 'TATKAL' ? Math.round(baseFare * 0.3 * 100) / 100 : 0
  const total = (baseFare + surcharge) * size

  useEffect(() => {
    let active = true
    trainService.list().then(rows => {
      if (!active) return
      const options = rows.map(row => ({ id: row.trainNumber, dbId: row.id, name: row.trainName, from: row.source, to: row.destination, depart: row.departureTime, arrive: row.arrivalTime, duration: row.duration, seats: row.coaches?.reduce((sum, coach) => sum + (coach._count?.seats ?? 0), 0) ?? 0, fare: Number(row.baseFare) }))
      setTrains(options)
      setTrain(current => options.some(option => `${option.id} · ${option.name}` === current) ? current : `${options[0]?.id ?? ''} · ${options[0]?.name ?? ''}`)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Train inventory could not be loaded.') })
    return () => { active = false }
  }, [])

  const changeQuota = (value: Quota) => {
    setQuota(value)
    const limit = value === 'TATKAL' ? 4 : 8
    setSize(current => Math.min(current, limit))
    setPassengers(current => current.slice(0, limit))
  }
  const changeSize = (value: number) => {
    const nextSize = Math.min(maxPassengers, Math.max(2, value || 2))
    setSize(nextSize)
    setPassengers(current => Array.from({ length: nextSize }, (_, index) => current[index] ?? { name: '', age: 25 }))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (passengers.some(passenger => passenger.name.trim().length < 2)) return setError('Enter each passenger’s full name.')
    setBusy(true)
    setError('')
    try {
      setResult(await onCreate({ train, date, passengers: passengers.map(passenger => ({ ...passenger, name: passenger.name.trim() })), preference, travelClass, quota }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Group reservation could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">RESERVATIONS / GROUPS</div><h1>Group booking</h1><p>Keep every passenger in the party within one class-matched reservation.</p></div></div>
    {result && <div className="confirmation" role="status"><span><Check size={16}/></span><div><strong>{result.booking.status} · {result.booking.pnr}</strong><small>{result.count} passengers · {result.seats.length ? `Seats ${result.seats.join(', ')}` : 'Whole party queued together'}</small></div></div>}
    <div className="booking-layout">
      <section className="panel form-panel"><div className="panel-heading"><div><h2>Party details</h2><p>One train and journey date for the whole party</p></div><span className="step-marker">{String(size).padStart(2, '0')} <i>/ {String(maxPassengers).padStart(2, '0')} MAX</i></span></div>
        <form className="booking-form" onSubmit={event => void submit(event)}>
          <label className="wide">Train<select value={train} onChange={event => setTrain(event.target.value)}>{trains.map(item => <option key={item.id} value={`${item.id} · ${item.name}`}>{item.id} · {item.name}</option>)}</select></label>
          <label>Journey date<input type="date" required value={date} onChange={event => setDate(event.target.value)}/></label>
          <label>Travel class<select value={travelClass} onChange={event => setTravelClass(event.target.value as TravelClass)}><option value="ALL">Any available class</option><option value="1A">1A · First AC</option><option value="2A">2A · AC 2 Tier</option><option value="3A">3A · AC 3 Tier</option><option value="SL">SL · Sleeper</option><option value="CC">CC · Chair Car</option></select></label>
          <label>Quota<select value={quota} onChange={event => changeQuota(event.target.value as Quota)}><option value="GENERAL">General</option><option value="TATKAL">Tatkal</option><option value="LADIES">Ladies</option><option value="SENIOR_CITIZEN">Senior citizen</option></select></label>
          <label>Party size<input type="number" min="2" max={maxPassengers} value={size} onChange={event => changeSize(Number(event.target.value))}/></label>
          {passengers.map((passenger, index) => <label key={index}>Passenger {index + 1}<input required minLength={2} value={passenger.name} onChange={event => setPassengers(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}/></label>)}
          <label className="wide">Seat preference<select value={preference} onChange={event => setPreference(event.target.value)}><option>No preference</option><option>Window</option><option>Middle</option><option>Aisle</option></select></label>
          {error && <div className="auth-error wide" role="alert">{error}</div>}
          <div className="form-footer"><button className="button primary" type="submit" disabled={busy || !selectedTrain || !date}><Users size={15}/>{busy ? 'Submitting…' : 'Reserve whole party'}</button></div>
        </form>
      </section>
      <aside className="panel quick-panel"><div className="panel-heading"><div><h2>Booking review</h2><p>{travelClass === 'ALL' ? 'Class selected from available inventory' : `Class ${travelClass}`} · {size} passengers</p></div></div>
        <div className="flow-step active"><span>1</span><div><strong>{quota === 'TATKAL' ? 'Tatkal quota' : 'Selected quota'}</strong><small className="quota-badge">{quota === 'TATKAL' ? '1.3× fare · maximum 4 passengers' : quota.replaceAll('_', ' ')}</small></div></div>
        <div className="fare-breakdown"><div><span>Base fare × {size}</span><strong>₹{(baseFare * size).toLocaleString('en-IN')}</strong></div>{quota === 'TATKAL' && <div><span>Tatkal surcharge (30%)</span><strong>₹{(surcharge * size).toLocaleString('en-IN')}</strong></div>}<div className="fare-total"><span>Estimated total</span><strong>₹{total.toLocaleString('en-IN')}</strong></div></div>
        <div className="algorithm-note"><Users size={16}/><div><strong>Atomic group allocation</strong><p>All {size} passengers are assigned together or remain together in the waiting queue.</p></div></div>
      </aside>
    </div>
  </>
}
