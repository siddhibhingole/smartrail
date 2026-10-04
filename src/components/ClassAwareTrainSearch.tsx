import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, RefreshCw, Search, TrainFront } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { trainService } from '../services/api'
import type { ApiTrain, TravelClass } from '../services/api'

type SearchState = { from?: string; to?: string; journeyDate?: string; travelClass?: TravelClass; searched?: boolean }
type TrainRow = ApiTrain & { availableSeats: number | null }
const classes: Array<{ value: TravelClass; label: string }> = [
  { value: 'ALL', label: 'All classes' }, { value: '1A', label: '1A · First AC' }, { value: '2A', label: '2A · AC 2 Tier' }, { value: '3A', label: '3A · AC 3 Tier' }, { value: 'SL', label: 'SL · Sleeper' }, { value: 'CC', label: 'CC · Chair Car' },
]
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

export function ClassAwareTrainSearch({ onBook }: { onBook: (train: string, date: string, travelClass: TravelClass) => void }) {
  const location = useLocation()
  const initial = location.state as SearchState | null
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')
  const [date, setDate] = useState(initial?.journeyDate ?? '')
  const [travelClass, setTravelClass] = useState<TravelClass>(initial?.travelClass ?? 'ALL')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<TrainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const loadSchedule = useCallback(async () => {
    setLoading(true); setError('')
    try { setRows((await trainService.list()).map(train => ({ ...train, availableSeats: null }))) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Train schedule could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadSchedule() }, [loadSchedule])

  const results = useMemo(() => rows.filter(train => (!from || train.source.toLowerCase().includes(from.toLowerCase())) && (!to || train.destination.toLowerCase().includes(to.toLowerCase())) && `${train.trainNumber} ${train.trainName}`.toLowerCase().includes(query.toLowerCase())), [rows, from, to, query])
  const search = async () => {
    if (!date) { setError('Choose a journey date to check availability.'); return }
    setSearched(true); setLoading(true); setError('')
    try {
      const trains = await trainService.list({ from, to, q: query })
      const inventory = await Promise.all(trains.map(async train => {
        const availability = await trainService.seats(train.id, date, travelClass)
        return { ...train, availableSeats: availability.seats.filter(seat => seat.status === 'AVAILABLE').length }
      }))
      setRows(inventory)
    } catch (cause) { setRows([]); setError(cause instanceof Error ? cause.message : 'Live availability could not be loaded.') }
    finally { setLoading(false) }
  }

  return <><div className="page-heading"><div><div className="eyebrow">NETWORK / TRAINS</div><h1>Find your train</h1><p>Compare dated seat availability by travel class.</p></div></div><section className="panel search-panel class-aware-search"><div className="search-fields"><label>From<input value={from} onChange={event => setFrom(event.target.value)} placeholder="Departure station"/></label><label>To<input value={to} onChange={event => setTo(event.target.value)} placeholder="Arrival station"/></label><label>Journey date<span className="input-icon"><CalendarDays size={14}/><input type="date" min={today()} value={date} onChange={event => setDate(event.target.value)}/></span></label><label>Class<select value={travelClass} onChange={event => setTravelClass(event.target.value as TravelClass)}>{classes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="button primary" type="button" disabled={loading} onClick={() => void search()}><Search size={15}/>{loading ? 'Checking…' : 'Search trains'}</button></div></section><div className="results-head"><div><h2>{searched ? `${results.length} trains found` : 'Train schedule'}</h2><p>{searched ? `${from || 'All origins'} to ${to || 'all destinations'} · ${date} · ${travelClass}` : 'Search for dated class availability'}</p></div><input aria-label="Filter train name or number" value={query} onChange={event => setQuery(event.target.value)} placeholder="Train name or number"/></div>{loading && <div className="data-state" role="status">Loading live train data…</div>}{error && <div className="data-state error-state" role="alert"><span>{error}</span><button className="icon-button" title="Retry" aria-label="Retry request" onClick={() => void (searched ? search() : loadSchedule())}><RefreshCw size={15}/></button></div>}<div className="train-list">{!searched && !loading ? results.map(train => <article className="panel train-card" key={train.id}><div className="train-title"><span className="train-icon"><TrainFront size={18}/></span><div><strong>{train.trainName}</strong><small>{train.trainNumber}</small></div></div><div className="train-route"><div><strong>{train.departureTime}</strong><small>{train.source}</small></div><div className="route-line"><span>{train.duration}</span><i/></div><div><strong>{train.arrivalTime}</strong><small>{train.destination}</small></div></div><div className="train-meta"><span>SCHEDULED<small>Choose date to check seats</small></span><span>BASE FARE<small className="fare">₹{Number(train.baseFare).toLocaleString('en-IN')}</small></span></div></article>) : searched && !loading ? results.map(train => <article className="panel train-card" key={train.id}><div className="train-title"><span className="train-icon"><TrainFront size={18}/></span><div><strong>{train.trainName}</strong><small>{train.trainNumber}</small></div></div><div className="train-route"><div><strong>{train.departureTime}</strong><small>{train.source}</small></div><div className="route-line"><span>{train.duration}</span><i/></div><div><strong>{train.arrivalTime}</strong><small>{train.destination}</small></div></div><div className="train-meta"><span>AVAILABLE<small>{train.availableSeats} seats</small></span><span>BASE FARE<small className="fare">₹{Number(train.baseFare).toLocaleString('en-IN')}</small></span><button className="button secondary" type="button" disabled={train.availableSeats === 0} onClick={() => onBook(`${train.trainNumber} · ${train.trainName}`, date, travelClass)}>Book <ArrowRight size={14}/></button></div></article>) : null}</div>{searched && !loading && !error && !results.length && <div className="empty-state">No trains match this route and class.</div>}</>
}
