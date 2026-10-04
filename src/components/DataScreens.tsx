import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType, FormEvent, ReactNode } from 'react'
import { Activity, ArrowUpRight, Clock3, RefreshCw, Search, ShieldCheck, Users, WalletCards, Zap } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analyticsService, ApiError, getAccessToken, passengerService, trainService, waitingListService } from '../services/api'
import type { ApiAnalyticsBookings, ApiAnalyticsOccupancy, ApiAnalyticsRevenue, ApiMedicalRequest, ApiPassengerRecord, ApiTrain, ApiWaitingEntry, TravelClass } from '../services/api'

type LoadState = { loading: boolean; error: string }
type ScreenProps = { notify: (message: string) => void }

function ScreenNotice({ state, onRetry }: { state: LoadState; onRetry?: () => void }) {
  if (state.loading) return <div className="data-state" role="status">Loading…</div>
  if (state.error) return <div className="data-state error-state" role="alert"><span>{state.error}</span>{onRetry && <button className="icon-button" title="Retry" aria-label="Retry request" onClick={onRetry}><RefreshCw size={15}/></button>}</div>
  return null
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'The request could not be completed. Check the connection and try again.'
}

type PassengerRow = { id: string; passengerId: string; name: string; age: number; pnr: string; train: string; coach: string; seat: string; status: string; date: string; contact: string }
function mapPassenger(record: ApiPassengerRecord): PassengerRow[] {
  if (!record.bookingPassengers?.length) return [{ id: record.id, passengerId: record.id, name: record.fullName, age: record.age, pnr: '—', train: '—', coach: '—', seat: '—', status: 'Passenger', date: '—', contact: record.phone ?? 'No contact' }]
  return record.bookingPassengers.map((item, index) => ({ id: `${record.id}-${index}`, passengerId: record.id, name: record.fullName, age: record.age, pnr: item.booking.pnr, train: `${item.booking.train.trainNumber} · ${item.booking.train.trainName}`, coach: item.coach?.coachNumber ?? '—', seat: item.seat?.seatNumber ?? '—', status: item.booking.status, date: item.booking.journeyDate.slice(0, 10), contact: record.phone ?? 'No contact' }))
}

export function Passengers() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PassengerRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [rows, setRows] = useState<PassengerRow[]>([])
  const [state, setState] = useState<LoadState>({ loading: true, error: '' })
  const [draft, setDraft] = useState({ name: '', age: '25', phone: '' })
  const load = useCallback(async () => {
    setState({ loading: true, error: '' })
    try { setRows((await passengerService.list()).flatMap(mapPassenger)); setState({ loading: false, error: '' }) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }, [])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => rows.filter(row => `${row.name} ${row.pnr} ${row.train}`.toLowerCase().includes(query.toLowerCase())), [rows, query])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setState({ loading: true, error: '' })
    try {
      if (selected) await passengerService.update(selected.passengerId, { fullName: draft.name, age: Number(draft.age), phone: draft.phone })
      else await passengerService.create({ fullName: draft.name, age: Number(draft.age), gender: 'UNDISCLOSED', ...(draft.phone ? { phone: draft.phone } : {}) })
      setSelected(null); setAdding(false); await load()
    } catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }
  return <><PageHeading eyebrow="PEOPLE / PASSENGERS" title="Passenger records" description="Passenger records managed by the reservation API." action={<button className="button secondary" onClick={() => { setDraft({ name: '', age: '25', phone: '' }); setAdding(true) }}><Users size={15}/> Add passenger</button>}/><section className="panel manifest-panel"><div className="panel-heading"><div><h2>Passenger directory</h2><p>{filtered.length} matching records</p></div><div className="input-icon compact"><Search size={15}/><input placeholder="Name, PNR or train" value={query} onChange={event => setQuery(event.target.value)}/></div></div><ScreenNotice state={state} onRetry={() => void load()}/>{filtered.length ? <div className="table-scroll"><table><thead><tr><th>PASSENGER</th><th>PNR</th><th>TRAIN</th><th>COACH / SEAT</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small className="cell-sub">Age {row.age} · {row.contact}</small></td><td className="pnr-text">{row.pnr}</td><td>{row.train}</td><td>{row.coach} / {row.seat}</td><td><span className={`status-badge ${row.status.toLowerCase()}`}><i/>{row.status}</span></td><td><button className="row-action" title="Edit passenger" aria-label={`Edit ${row.name}`} onClick={() => { setDraft({ name: row.name, age: String(row.age), phone: row.contact === 'No contact' ? '' : row.contact }); setSelected(row) }}><Users size={15}/></button></td></tr>)}</tbody></table></div> : !state.loading && !state.error ? <Empty text="No passengers found"/> : null}</section>{(selected || adding) && <div className="modal-backdrop" onClick={() => { setSelected(null); setAdding(false) }}><section className="modal" onClick={event => event.stopPropagation()}><div className="panel-heading"><div><div className="eyebrow">PASSENGER RECORD</div><h2>{adding ? 'Add passenger' : selected?.name}</h2></div><button className="icon-button" onClick={() => { setSelected(null); setAdding(false) }} aria-label="Close">×</button></div><form className="booking-form" onSubmit={event => void save(event)}><label className="wide">Full name<input required minLength={2} maxLength={120} value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))}/></label><label>Age<input required type="number" min="1" max="120" value={draft.age} onChange={event => setDraft(value => ({ ...value, age: event.target.value }))}/></label><label>Phone<input value={draft.phone} onChange={event => setDraft(value => ({ ...value, phone: event.target.value }))}/></label><div className="form-footer"><span/><button className="button primary" type="submit" disabled={state.loading}>{state.loading ? 'Saving…' : adding ? 'Create passenger' : 'Save changes'}</button></div></form></section></div>}</>
}

export function Waiting({ canPromote, onPromoted }: { canPromote: boolean; onPromoted: () => Promise<unknown> }) {
  const [entries, setEntries] = useState<ApiWaitingEntry[]>([])
  const [state, setState] = useState<LoadState>({ loading: true, error: '' })
  const load = useCallback(async () => {
    setState({ loading: true, error: '' })
    try { setEntries(await waitingListService.list()); setState({ loading: false, error: '' }) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }, [])
  useEffect(() => { void load() }, [load])
  const promote = async (entry: ApiWaitingEntry) => {
    setState({ loading: true, error: '' })
    try { await waitingListService.promote(entry.id); await Promise.all([load(), onPromoted()]) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }
  const rows = entries.filter(entry => entry.status === 'WAITING')
  return <><PageHeading eyebrow="QUEUE / FIFO" title="Waiting list" description="Passengers move in queue order when a matching seat is released."/><section className="panel queue-page"><div className="panel-heading"><div><h2>Current queue</h2><p>{rows.length} passengers awaiting allocation</p></div><span className="queue-count">{String(rows.length).padStart(2, '0')} IN QUEUE</span></div><ScreenNotice state={state} onRetry={() => void load()}/>{rows.length ? rows.map(entry => <div className="waiting-person" key={entry.id}><div className="queue-number large">{String(entry.position).padStart(2, '0')}</div><div className="waiting-person-main"><strong>{entry.booking.passengers[0]?.passenger.fullName ?? 'Passenger'}</strong><small>{entry.booking.pnr} · {entry.booking.train.trainNumber} · {entry.booking.train.trainName}</small></div><div className="waiting-meta"><small>JOURNEY DATE</small><strong>{entry.booking.journeyDate.slice(0, 10)}</strong></div><span className="status-badge waiting"><i/>Waiting</span>{canPromote && <button className="button secondary" disabled={state.loading} onClick={() => void promote(entry)}>Promote</button>}</div>) : !state.loading && !state.error ? <Empty text="No passengers are currently waiting"/> : null}</section></>
}

export function Analytics() {
  const [occupancy, setOccupancy] = useState<ApiAnalyticsOccupancy | null>(null)
  const [bookings, setBookings] = useState<ApiAnalyticsBookings | null>(null)
  const [revenue, setRevenue] = useState<ApiAnalyticsRevenue | null>(null)
  const [state, setState] = useState<LoadState>({ loading: true, error: '' })
  const load = useCallback(async () => {
    setState({ loading: true, error: '' })
    try { const [o, b, r] = await Promise.all([analyticsService.occupancy(), analyticsService.bookings(), analyticsService.revenue()]); setOccupancy(o); setBookings(b); setRevenue(r); setState({ loading: false, error: '' }) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }, [])
  useEffect(() => { void load() }, [load])
  const chartData = bookings?.byStatus.map(row => ({ name: row.status, count: row.count })) ?? []
  return <><PageHeading eyebrow="INSIGHTS / NETWORK" title="Occupancy analytics" description="Reservation and capacity metrics from the operations database."/><ScreenNotice state={state} onRetry={() => void load()}/><div className="stats-grid analytics-stats"><Stat label="Seat slots" value={(occupancy?.totalSeats ?? 0).toLocaleString()} change="Across active journey dates" icon={WalletCards}/><Stat label="Occupied seats" value={(occupancy?.occupiedSeats ?? 0).toLocaleString()} change={`${occupancy?.occupancyPercent ?? 0}% occupancy`} icon={Activity}/><Stat label="Available seats" value={(occupancy?.availableSeats ?? 0).toLocaleString()} change={`${occupancy?.heldSeats ?? 0} currently held`} icon={ArrowUpRight}/><Stat label="Waiting passengers" value={(occupancy?.waitingPassengers ?? 0).toLocaleString()} change="Live queue" icon={Clock3}/></div><div className="dashboard-grid analytics-grid"><section className="panel analytic-chart"><div className="panel-heading"><div><h2>Bookings by status</h2><p>{(bookings?.total ?? 0).toLocaleString()} total reservations</p></div></div><div className="chart-area tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barSize={32}><CartesianGrid vertical={false} stroke="#e5e8e1"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7b8580', fontSize: 11 }}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#7b8580', fontSize: 11 }}/><Tooltip/><Bar dataKey="count" fill="#284B63" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></section><section className="panel analytic-status"><div className="panel-heading"><div><h2>Reservation mix</h2><p>Current reservation states</p></div></div>{chartData.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height={185}><PieChart><Pie data={chartData} dataKey="count" nameKey="name" innerRadius={56} outerRadius={77} paddingAngle={3} stroke="none">{chartData.map((_, index) => <Cell key={index} fill={['#284B63', '#B4B8AB', '#153243', '#b24b3f'][index % 4]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{bookings?.total ?? 0}</strong><small>bookings</small></div></div><div className="occupancy-legend">{chartData.map((row, index) => <div key={row.name}><span><i className={['legend-blue', 'legend-gray', 'legend-navy'][index % 3]}/>{row.name}</span><strong>{row.count}</strong></div>)}</div></> : !state.loading && !state.error ? <Empty text="No booking metrics are available yet"/> : null}<div className="revenue-summary"><span><WalletCards size={15}/> Net revenue</span><strong>₹{(Number(revenue?.revenue ?? 0) - Number(revenue?.refunds ?? 0)).toLocaleString('en-IN')}</strong></div></section></div></>
}

export function Allocation({ notify }: ScreenProps) {
  const [trains, setTrains] = useState<ApiTrain[]>([])
  const [trainId, setTrainId] = useState('')
  const [date, setDate] = useState('')
  const [travelClass, setTravelClass] = useState<TravelClass>('ALL')
  const [seats, setSeats] = useState<Awaited<ReturnType<typeof trainService.seats>>['seats']>([])
  const [selected, setSelected] = useState<string[]>([])
  const [preference, setPreference] = useState<'WINDOW' | 'MIDDLE' | 'AISLE' | ''>('')
  const [group, setGroup] = useState(false)
  const [holdToken, setHoldToken] = useState('')
  const [holdUntil, setHoldUntil] = useState('')
  const [state, setState] = useState<LoadState>({ loading: true, error: '' })
  const loadTrains = useCallback(async () => {
    setState({ loading: true, error: '' })
    try { const result = await trainService.list(); setTrains(result); setTrainId(current => current && result.some(train => train.id === current) ? current : result[0]?.id ?? ''); setState({ loading: false, error: '' }) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }, [])
  const loadSeats = useCallback(async () => {
    if (!trainId || !date) { setSeats([]); return }
    setState({ loading: true, error: '' })
    try { const result = await trainService.seats(trainId, date, travelClass); setSeats(result.seats); setSelected([]); setState({ loading: false, error: '' }) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }, [trainId, date, travelClass])
  useEffect(() => { void loadTrains() }, [loadTrains])
  useEffect(() => { void loadSeats() }, [loadSeats])
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const allocate = async () => {
    if (!getAccessToken()) return setState({ loading: false, error: 'Sign in to request a seat hold.' })
    if (!selected.length) return setState({ loading: false, error: 'Select at least one available seat.' })
    setState({ loading: true, error: '' })
    try { const result = await trainService.hold({ trainId, journeyDate: date, passengerCount: selected.length, seatPreference: preference || undefined, seatIds: selected, groupBooking: group, travelClass }); setHoldToken(result.holdToken); setHoldUntil(result.heldUntil); setSelected([]); await loadSeats(); notify(`Seat hold created · ${result.seats.map(seat => `${seat.coach}/${seat.seatNumber}`).join(', ')}`) }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }
  const release = async () => {
    if (!holdToken) return
    setState({ loading: true, error: '' })
    try { await trainService.release(holdToken); setHoldToken(''); setHoldUntil(''); await loadSeats(); notify('Seat hold released') }
    catch (error) { setState({ loading: false, error: errorMessage(error) }) }
  }
  const train = trains.find(item => item.id === trainId)
  return <><PageHeading eyebrow="ALLOCATION / SEAT ARRAY" title="Smart seat allocation" description="Inspect dated coach inventory and request a database-backed seat hold."/><div className="allocation-layout"><section className="panel allocation-panel"><div className="panel-heading"><div><h2>{train ? `${train.trainNumber} · ${train.trainName}` : 'Select a train'}</h2><p>{seats.length} seats · dated availability</p></div></div><div className="allocation-selectors"><label>Train<select value={trainId} onChange={event => setTrainId(event.target.value)}>{trains.map(item => <option key={item.id} value={item.id}>{item.trainNumber} · {item.trainName}</option>)}</select></label><label>Journey date<input type="date" required value={date} onChange={event => setDate(event.target.value)}/></label><label>Class<select value={travelClass} onChange={event => setTravelClass(event.target.value as TravelClass)}>{(['ALL', '1A', '2A', '3A', 'SL', 'CC'] as TravelClass[]).map(value => <option key={value} value={value}>{value === 'ALL' ? 'All classes' : value}</option>)}</select></label><button className="button secondary" onClick={() => void loadSeats()} disabled={state.loading || !trainId || !date}>Check availability</button></div><ScreenNotice state={state} onRetry={() => void (trainId && date ? loadSeats() : loadTrains())}/>{seats.length ? <><div className="coach-label"><span>WINDOW</span><span>AISLE</span><span>AISLE</span><span>WINDOW</span></div><div className="seat-grid">{seats.map(seat => { const occupied = seat.status !== 'AVAILABLE'; const chosen = selected.includes(seat.id); return <button key={seat.id} disabled={occupied || state.loading} className={`seat ${occupied ? 'occupied' : ''} ${holdToken && occupied ? 'allocated' : ''} ${chosen ? 'chosen' : ''}`} onClick={() => toggle(seat.id)} aria-label={`${seat.coach} seat ${seat.seatNumber}${occupied ? ', unavailable' : ', available'}`}>{seat.seatNumber}</button> })}</div><div className="seat-legend"><span><i className="seat-key available-key"/>Available</span><span><i className="seat-key occupied-key"/>Unavailable</span><span><i className="seat-key allocated-key"/>Selected / held</span></div></> : !state.loading && !state.error ? <Empty text="No seats are available for this selection"/> : null}</section><section className="panel allocation-controls"><div className="panel-heading"><div><h2>Allocation request</h2><p>{selected.length} seats selected</p></div></div><label>Seat preference<select value={preference} onChange={event => setPreference(event.target.value as typeof preference)}><option value="">No preference</option><option value="WINDOW">Window</option><option value="MIDDLE">Middle</option><option value="AISLE">Aisle</option></select></label><label className="toggle-row"><span>Keep group together<small>Request a contiguous block where available</small></span><input type="checkbox" checked={group} onChange={event => setGroup(event.target.checked)}/></label><button className="button primary" disabled={state.loading || !trainId || !date || !selected.length} onClick={() => void allocate()}><Zap size={16}/> Hold selected seats</button>{holdToken && <div className="allocation-result"><span className="result-check"><ShieldCheck size={15}/></span><div><strong>Temporary hold active</strong><small>Expires {new Date(holdUntil).toLocaleTimeString()}</small><button className="text-link" onClick={() => void release()}>Release hold</button></div></div>}</section></div></>
}

export function medicalRow(request: ApiMedicalRequest) {
  return { id: request.id, pnr: request.pnr, coach: request.coach, seat: request.seat, details: request.condition, priority: request.priority === 'HIGH' ? 'High' as const : request.priority === 'MEDIUM' ? 'Medium' as const : 'Normal' as const, status: request.status }
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div> }
function Stat({ label, value, change, icon: Icon }: { label: string; value: string; change: string; icon: ComponentType<{ size?: number }> }) { return <article className="panel stat-card"><div className="stat-top"><span>{label}</span><i><Icon size={16}/></i></div><strong className="stat-value">{value}</strong><small className="stat-change">{change}</small></article> }
