import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, BarChart3, Bell, CalendarDays, Check, CircleHelp, Clock3, HeartPulse, LayoutDashboard, ListOrdered, LogIn, LogOut, Menu, Search, ShieldCheck, Ticket, TrainFront, Undo2, UserRound, Users, WalletCards, X, Zap, Ban, RefreshCw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Booking, MedicalRequest } from './data'
import { analyticsService, authService, bookingService, medicalService, systemService, trainService, transactionService } from './services/api'
import type { ApiBooking, ApiTransaction, ApiUser, TravelClass } from './services/api'
import { Analytics, Allocation, Passengers, Waiting, medicalRow } from './components/DataScreens'
import { useAuthStore } from './stores/authStore'
import { ClassAwareTrainSearch } from './components/ClassAwareTrainSearch'
import { BookingCheckout } from './components/BookingCheckout'
import { GroupBookingCheckout } from './components/GroupBookingCheckout'

const routes = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }, { label: 'Train search', path: '/trains', icon: TrainFront }, { label: 'Bookings', path: '/bookings', icon: Ticket }, { label: 'Group booking', path: '/group-booking', icon: Users }, { label: 'Passengers', path: '/passengers', icon: UserRound }, { label: 'Seat allocation', path: '/allocation', icon: Zap }, { label: 'Waiting list', path: '/waiting', icon: ListOrdered }, { label: 'PNR lookup', path: '/pnr', icon: Search }, { label: 'Cancellation & undo', path: '/transactions', icon: Undo2 }, { label: 'Medical support', path: '/medical', icon: HeartPulse }, { label: 'Analytics', path: '/analytics', icon: BarChart3 },
]
const navLabels = Object.fromEntries(routes.map(route => [route.path, route.label]))
type LoadState = { loading: boolean; error: string }

export default function App() {
  const { session, setSession } = useAuthStore()
  const [authLoading, setAuthLoading] = useState(Boolean(session.token))
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsState, setBookingsState] = useState<LoadState>({ loading: false, error: '' })
  const [toast, setToast] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [transactions, setTransactions] = useState<ApiTransaction[]>([])
  const [transactionState, setTransactionState] = useState<LoadState>({ loading: false, error: '' })
  const [apiOnline, setApiOnline] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const check = () => { void systemService.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false)) }
    check()
    const interval = window.setInterval(check, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!session.token) { setAuthLoading(false); return }
    let active = true
    setAuthLoading(true)
    authService.me().then(user => { if (active) setSession({ token: session.token, user }) }).catch(() => { if (active) { authService.signOut(); setSession({ token: null, user: null }) } }).finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [session.token, setSession])

  const reloadRemoteBookings = useCallback(async () => {
    setBookingsState({ loading: true, error: '' })
    try { const rows = (await bookingService.list()).map(toLocalBooking); setBookings(rows); setBookingsState({ loading: false, error: '' }); return rows }
    catch (error) { setBookingsState({ loading: false, error: message(error) }); throw error }
  }, [])
  const reloadTransactions = useCallback(async () => {
    setTransactionState({ loading: true, error: '' })
    try { setTransactions(await transactionService.list()); setTransactionState({ loading: false, error: '' }) }
    catch (error) { setTransactionState({ loading: false, error: message(error) }) }
  }, [])
  useEffect(() => { if (session.user) { void reloadRemoteBookings(); void reloadTransactions() } else { setBookings([]); setTransactions([]) } }, [session.user, reloadRemoteBookings, reloadTransactions])

  const resolveTrain = async (trainLabel: string) => {
    const number = trainLabel.split(' · ')[0] ?? ''
    const train = (await trainService.list({ q: number })).find(item => item.trainNumber === number)
    if (!train) throw new Error('Train was not found in the live schedule.')
    return train
  }
  const createBooking = async (person: Omit<Booking, 'pnr' | 'status'>): Promise<Booking> => {
    const train = await resolveTrain(person.train)
    const phone = /^\+?[0-9 -]{7,20}$/.test(person.contact) ? person.contact : undefined
    const result = await bookingService.create({ trainId: train.id, journeyDate: person.date, passengers: [{ fullName: person.name, age: person.age, gender: 'UNDISCLOSED', ...(phone ? { phone } : {}) }], seatPreference: preferenceToApi(person.preference), groupBooking: false, quota: person.quota ?? 'GENERAL', travelClass: person.travelClass ?? 'ALL', paymentMethod: 'UPI', idempotencyKey: crypto.randomUUID() })
    const booking = toLocalBooking({ ...result, train: result.train ?? train } as ApiBooking)
    await reloadRemoteBookings().catch(() => notify('Reservation submitted; the manifest could not be refreshed.'))
    notify(`Reservation created · ${booking.pnr}`)
    return booking
  }
  const createGroupBooking = async (input: { train: string; date: string; passengers: Array<{ name: string; age: number }>; preference: string; travelClass?: TravelClass; quota?: 'GENERAL' | 'TATKAL' | 'LADIES' | 'SENIOR_CITIZEN' }) => {
    const train = await resolveTrain(input.train)
    const result = await bookingService.create({ trainId: train.id, journeyDate: input.date, passengers: input.passengers.map(passenger => ({ fullName: passenger.name, age: passenger.age, gender: 'UNDISCLOSED' })), seatPreference: preferenceToApi(input.preference), groupBooking: true, quota: input.quota ?? 'GENERAL', travelClass: input.travelClass ?? 'ALL', paymentMethod: 'UPI', idempotencyKey: crypto.randomUUID() })
    const booking = toLocalBooking({ ...result, train: result.train ?? train } as ApiBooking)
    await reloadRemoteBookings().catch(() => notify('Group reservation submitted; the manifest could not be refreshed.'))
    return { booking: { ...booking, name: input.passengers.map(passenger => passenger.name).join(', ') }, count: input.passengers.length, seats: result.passengers.map(passenger => passenger.seat?.seatNumber).filter((seat): seat is string => Boolean(seat)) }
  }
  const cancel = async (pnr: string) => {
    const target = bookings.find(booking => booking.pnr === pnr)
    if (!target?.id) return notify('Booking record is no longer available. Refresh the list and try again.')
    try { const result = await bookingService.cancel(target.id); await Promise.all([reloadRemoteBookings(), reloadTransactions()]); notify(result.promotedBookingId ? 'Booking cancelled; next eligible passenger promoted' : 'Booking cancelled') }
    catch (error) { notify(message(error)) }
  }
  const undo = async () => {
    try { await transactionService.undo(); await Promise.all([reloadRemoteBookings(), reloadTransactions()]); notify('Latest transaction reversed') }
    catch (error) { notify(message(error)) }
  }
  const signOut = () => { authService.signOut(); setSession({ token: null, user: null }); navigate('/login'); notify('Signed out') }
  const title = navLabels[location.pathname] ?? 'SmartRail'
  const protect = (element: React.ReactNode) => authLoading ? <div className="data-state" role="status">Checking session…</div> : session.user ? element : <AuthRequired onLogin={() => navigate('/login')}/>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="brand"><span className="brand-mark"><TrainFront size={20}/></span><span><strong>SMART RAIL</strong><small>RAILWAY OPERATIONS</small></span><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18}/></button></div><div className="nav-caption">OPERATIONS</div><nav className="side-nav">{routes.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={17}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom">{session.user ? <div className="account-row"><span className="avatar profile-avatar"><UserRound size={16}/></span><span className="account-copy"><strong>{session.user.name}</strong><small>{session.user.role.toLowerCase()}</small></span><button className="signout-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={15}/><span>Sign out</span></button></div> : <button className="backend-session" onClick={() => navigate('/login')}><span className="avatar profile-avatar"><UserRound size={16}/></span><span><strong>{authLoading ? 'Loading account' : 'Sign in'}</strong><small>Connect to operations</small></span><LogIn size={15}/></button>}</div></aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19}/></button><div className="breadcrumb">Operations <span>/</span> <strong>{title}</strong></div></div><div className="topbar-actions"><div className="system-live"><span className={`status-dot ${apiOnline ? '' : 'offline'}`}/>{apiOnline ? 'API connected' : 'API unavailable'}</div><button className="icon-button" aria-label="Notifications" onClick={() => notify('No new notifications')}><Bell size={18}/></button><div className="top-divider"/><div className="top-date"><CalendarDays size={15}/>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div></div></header>
      <div className="page-wrap"><Routes>
        <Route path="/login" element={session.user ? <Navigate to="/dashboard" replace/> : <AuthPage onAuthenticated={result => { setSession({ token: result.accessToken, user: result.user }); navigate('/dashboard') }}/>} />
        <Route path="/" element={<Landing onLogin={() => navigate('/login')} onSearch={() => navigate(session.user ? '/trains' : '/login')}/>} />
        <Route path="/dashboard" element={protect(<Dashboard bookings={bookings} state={bookingsState} onRetry={() => void reloadRemoteBookings()} onNavigate={navigate} onCancel={cancel}/>)} />
        <Route path="/trains" element={protect(<ClassAwareTrainSearch onBook={(train, journeyDate, travelClass) => navigate('/bookings', { state: { train, journeyDate, travelClass } })}/>)} />
        <Route path="/bookings" element={protect(<BookingCheckout onCreate={createBooking} bookings={bookings} bookingsState={bookingsState} onRetry={() => void reloadRemoteBookings()}/>)} />
        <Route path="/group-booking" element={protect(<GroupBookingCheckout onCreate={createGroupBooking}/>)} />
        <Route path="/passengers" element={protect(<Passengers/>)} />
        <Route path="/allocation" element={protect(<Allocation notify={notify}/>)} />
        <Route path="/waiting" element={protect(<Waiting canPromote={session.user?.role === 'ADMIN' || session.user?.role === 'STAFF'} onPromoted={reloadRemoteBookings}/>)} />
        <Route path="/transactions" element={protect(<Transactions bookings={bookings} transactions={transactions} state={transactionState} onRetry={() => void reloadTransactions()} onCancel={cancel} onUndo={undo}/>)} />
        <Route path="/pnr" element={protect(<PnrLookup/>)} />
        <Route path="/medical" element={protect(<Medical notify={notify}/>)} />
        <Route path="/analytics" element={protect(<Analytics/>)} />
        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes></div>
    </main>{toast && <div role="status" className="toast"><span className="toast-icon"><Check size={15}/></span>{toast}</div>}
  </div>
}

function toLocalBooking(remote: ApiBooking): Booking {
  const first = remote.passengers[0]
  const status: Booking['status'] = remote.status === 'WAITING' ? 'Waiting' : remote.status === 'CANCELLED' ? 'Cancelled' : remote.status === 'PENDING' ? 'Pending' : remote.status === 'FAILED' ? 'Failed' : 'Confirmed'
  return { id: remote.id, pnr: remote.pnr, name: first?.passenger.fullName ?? 'Passenger', age: first?.passenger.age ?? 0, contact: 'API record', train: `${remote.train.trainNumber} · ${remote.train.trainName}`, coach: first?.coach?.coachNumber ?? '—', seat: first?.seat?.seatNumber ?? '—', date: remote.journeyDate.slice(0, 10), status, paymentMethod: remote.payment?.paymentMethod, quota: remote.quota, travelClass: remote.travelClass }
}
function preferenceToApi(value?: string): 'WINDOW' | 'MIDDLE' | 'AISLE' | undefined { if (value?.toLowerCase() === 'window') return 'WINDOW'; if (value?.toLowerCase() === 'middle') return 'MIDDLE'; if (value?.toLowerCase() === 'aisle') return 'AISLE'; return undefined }
function message(error: unknown) { return error instanceof Error ? error.message : 'The request could not be completed.' }

function AuthRequired({ onLogin }: { onLogin: () => void }) { return <section className="panel empty-state"><div><h1>Sign in required</h1><p>Connect to the live reservation service to view or change operational data.</p><button className="button primary" onClick={onLogin}><LogIn size={16}/> Sign in</button></div></section> }
function AuthPage({ onAuthenticated }: { onAuthenticated: (result: { accessToken: string; user: ApiUser }) => void }) {
  const [register, setRegister] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { onAuthenticated(register ? await authService.register({ name, email, phone: phone || undefined, password }) : await authService.login(email, password)) } catch (cause) { setError(message(cause)) } finally { setBusy(false) } }
  return <div className="auth-wrap"><section className="panel auth-panel"><div className="auth-brand"><span className="brand-mark"><TrainFront size={20}/></span><span><strong>SMART RAIL</strong><small>OPERATIONS ACCESS</small></span></div><div className="eyebrow">{register ? 'CREATE ACCOUNT' : 'API CONNECTION'}</div><h1>{register ? 'Create your account' : 'Sign in to SmartRail'}</h1><p>Sign in to access live train, reservation, and support records.</p><form onSubmit={event => void submit(event)} className="auth-form">{register && <label>Full name<input required value={name} onChange={event => setName(event.target.value)} autoComplete="name"/></label>}<label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email"/></label>{register && <label>Phone <span>(optional)</span><input type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel"/></label>}<label>Password<input required type="password" minLength={register ? 8 : 1} value={password} onChange={event => setPassword(event.target.value)} autoComplete={register ? 'new-password' : 'current-password'}/></label>{error && <div className="auth-error" role="alert">{error}</div>}<Button type="submit" disabled={busy} icon={<LogIn size={16}/>}>{busy ? 'Connecting…' : register ? 'Create account' : 'Sign in'}</Button></form><button className="text-link" onClick={() => { setRegister(value => !value); setError('') }}>{register ? 'Already registered? Sign in' : 'Need an account? Register'}</button><div className="auth-note"><ShieldCheck size={15}/> Credentials are validated by the API.</div></section></div>
}

function Dashboard({ bookings, state, onRetry, onNavigate, onCancel }: { bookings: Booking[]; state: LoadState; onRetry: () => void; onNavigate: (path: string) => void; onCancel: (pnr: string) => void }) {
  const [metrics, setMetrics] = useState<{ occupancy: Awaited<ReturnType<typeof analyticsService.occupancy>>; totals: Awaited<ReturnType<typeof analyticsService.bookings>>; trainCount: number; medicalCount: number } | null>(null)
  const [metricState, setMetricState] = useState<LoadState>({ loading: true, error: '' })
  const load = useCallback(async () => { setMetricState({ loading: true, error: '' }); try { const [occupancy, totals, trains, medical] = await Promise.all([analyticsService.occupancy(), analyticsService.bookings(), trainService.list(), medicalService.list()]); setMetrics({ occupancy, totals, trainCount: trains.length, medicalCount: medical.length }); setMetricState({ loading: false, error: '' }) } catch (error) { setMetricState({ loading: false, error: message(error) }) } }, [])
  useEffect(() => { void load() }, [load])
  const stats = [{ label: 'Active trains', value: metrics?.trainCount ?? 0, icon: TrainFront }, { label: 'Available seats', value: metrics?.occupancy.availableSeats ?? 0, icon: WalletCards }, { label: 'Confirmed bookings', value: metrics?.totals.confirmed ?? 0, icon: Ticket }, { label: 'Waiting passengers', value: metrics?.occupancy.waitingPassengers ?? 0, icon: Clock3 }, { label: 'Occupancy rate', value: `${metrics?.occupancy.occupancyPercent ?? 0}%`, icon: Activity }, { label: 'Medical requests', value: metrics?.medicalCount ?? 0, icon: HeartPulse }]
  const chart = metrics?.totals.byStatus.map(item => ({ status: item.status, total: item.count })) ?? []
  return <><PageHeading eyebrow="NETWORK / OPERATIONS" title="Operations dashboard" description="Current reservation, seat availability, and network status." action={<Button onClick={() => onNavigate('/trains')} icon={<ArrowRight size={16}/>}>New booking</Button>}/><ScreenNotice state={metricState} onRetry={() => void load()}/><div className="stats-grid">{stats.map(stat => <Stat key={stat.label} {...stat}/>)}</div><div className="dashboard-grid"><section className="panel booking-chart"><div className="panel-heading"><div><h2>Reservations by status</h2><p>Live counts from the reservation database</p></div></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid vertical={false} stroke="#e5e8e1"/><XAxis dataKey="status" axisLine={false} tickLine={false}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="total" fill="#284B63" radius={[3, 3, 0, 0]}/></BarChart></ResponsiveContainer></div></section><section className="panel queue-panel"><div className="panel-heading"><div><h2>Waiting queue</h2><p>{bookings.filter(booking => booking.status === 'Waiting').length} current reservations in your list</p></div></div>{bookings.filter(booking => booking.status === 'Waiting').slice(0, 4).map(booking => <div className="queue-row" key={booking.pnr}><span className="queue-number">{booking.pnr}</span><span><strong>{booking.name}</strong><small>{booking.train}</small></span></div>)}{!state.loading && !state.error && !bookings.some(booking => booking.status === 'Waiting') && <Empty text="No waiting bookings"/>}<button className="text-link" onClick={() => onNavigate('/waiting')}>Open waiting list <ArrowRight size={14}/></button></section></div><section className="panel table-panel"><div className="panel-heading"><div><h2>Recent bookings</h2><p>Latest records from the API</p></div><button className="text-link" onClick={() => onNavigate('/bookings')}>View all <ArrowRight size={14}/></button></div><ScreenNotice state={state} onRetry={onRetry}/>{bookings.length > 0 ? <BookingTable bookings={bookings.slice(0, 5)} onCancel={onCancel}/> : !state.loading && !state.error ? <Empty text="No reservations found"/> : null}</section></>
}

function Landing({ onLogin, onSearch }: { onLogin: () => void; onSearch: () => void }) { return <section className="landing-hero"><div className="landing-copy"><div className="eyebrow">RAILWAY OPERATIONS</div><h1>SMART RAIL</h1><h2>Railway Reservation<br/>Management System</h2><p className="landing-tagline">Live scheduling, bookings, and passenger operations.</p><div className="landing-shortcuts"><button className="button primary" onClick={onLogin}><LogIn size={16}/> Sign in</button><button className="button secondary" onClick={onSearch}><Search size={16}/> Find a train</button></div></div><div className="landing-route"><div className="route-map"><div className="route-track"><span className="route-station start"/><span className="route-station end"/><i className="route-train"><TrainFront size={20}/></i></div><div className="route-labels"><span><small>LIVE OPERATIONS</small><strong>Train schedules</strong></span><span><small>CONNECTED RECORDS</small><strong>Passenger journeys</strong></span></div></div></div></section> }

function BookingTable({ bookings, onCancel }: { bookings: Booking[]; onCancel: (pnr: string) => void }) { return <div className="table-scroll"><table><thead><tr><th>PNR / PASSENGER</th><th>TRAIN</th><th>COACH / SEAT</th><th>STATUS</th><th></th></tr></thead><tbody>{bookings.map(booking => <tr key={booking.pnr}><td><strong className="pnr-text">{booking.pnr}</strong><small className="cell-sub">{booking.name}</small></td><td>{booking.train}<small className="cell-sub">{booking.date}</small></td><td>{booking.coach} / {booking.seat}</td><td><Status value={booking.status}/></td><td><button className="row-action" aria-label={`Cancel ${booking.pnr}`} title="Cancel booking" disabled={booking.status !== 'Confirmed'} onClick={() => onCancel(booking.pnr)}><X size={15}/></button></td></tr>)}</tbody></table></div> }

function Transactions({ bookings, transactions, state, onRetry, onCancel, onUndo }: { bookings: Booking[]; transactions: ApiTransaction[]; state: LoadState; onRetry: () => void; onCancel: (pnr: string) => void; onUndo: () => void }) {
  const [pending, setPending] = useState<Booking | null>(null)
  const undoable = transactions.some(transaction => transaction.status === 'SUCCESS' && ['BOOKING', 'CANCELLATION'].includes(transaction.type))
  return <><PageHeading eyebrow="TRANSACTIONS / AUDIT" title="Cancellation & undo" description="Review recorded transactions and cancel eligible reservations." action={<Button variant="secondary" onClick={onUndo} disabled={!undoable} icon={<Undo2 size={16}/>}>Undo latest</Button>}/><ScreenNotice state={state} onRetry={onRetry}/><section className="panel manifest-panel"><div className="panel-heading"><div><h2>Reservations</h2><p>Cancellation is committed by the backend.</p></div></div><BookingTable bookings={bookings} onCancel={pnr => setPending(bookings.find(booking => booking.pnr === pnr) ?? null)}/></section><section className="panel stack-panel"><div className="panel-heading"><div><h2>Transaction history</h2><p>Ledger entries from the database</p></div></div>{transactions.length ? transactions.map(transaction => <div className="stack-item" key={transaction.id}><span>{transaction.type} · {transaction.status}</span><small>{transaction.booking?.pnr ?? transaction.referenceId} · {new Date(transaction.createdAt).toLocaleString()}</small></div>) : !state.loading && !state.error ? <Empty text="No transactions found"/> : null}</section>{pending && <div className="modal-backdrop" onClick={() => setPending(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title" onClick={event => event.stopPropagation()}><div className="panel-heading"><div><div className="eyebrow">RELEASE SEAT</div><h2 id="cancel-title">Cancel booking?</h2></div><button className="icon-button" onClick={() => setPending(null)} aria-label="Close"><X size={17}/></button></div><p className="confirm-copy">Cancel {pending.pnr} for {pending.name}? The backend will release the seat and process eligible waiting-list promotion.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setPending(null)}>Keep booking</Button><Button onClick={() => { onCancel(pending.pnr); setPending(null) }} icon={<Ban size={15}/>}>Confirm cancellation</Button></div></section></div>}</>
}

function PnrLookup() {
  const [value, setValue] = useState(''); const [result, setResult] = useState<Booking | null>(null); const [state, setState] = useState<LoadState>({ loading: false, error: '' }); const [searched, setSearched] = useState(false)
  const lookup = async () => { setSearched(true); setState({ loading: true, error: '' }); setResult(null); try { setResult(toLocalBooking(await bookingService.pnr(value.trim()))); setState({ loading: false, error: '' }) } catch (error) { setState({ loading: false, error: message(error) }) } }
  return <><PageHeading eyebrow="JOURNEY / PNR STATUS" title="PNR lookup" description="Retrieve reservation status and journey details from the booking database."/><section className="panel pnr-search-panel"><div className="pnr-search-copy"><span className="search-emblem"><Search size={20}/></span><h2>Check your reservation</h2><p>Enter the PNR from your booking confirmation.</p></div><form onSubmit={event => { event.preventDefault(); void lookup() }} className="pnr-form"><label htmlFor="pnr">Passenger name record</label><div className="pnr-input-row"><input id="pnr" required value={value} onChange={event => setValue(event.target.value.toUpperCase())} placeholder="Enter PNR"/><Button type="submit" disabled={state.loading} icon={<Search size={16}/>}>{state.loading ? 'Searching…' : 'Search PNR'}</Button></div></form>{state.error && <div className="data-state error-state" role="alert">{state.error}<button className="icon-button" aria-label="Retry PNR search" onClick={() => void lookup()}><RefreshCw size={15}/></button></div>}{searched && !state.loading && !state.error && result && <div className="pnr-result"><div className="pnr-result-head"><div><small>BOOKING REFERENCE</small><strong>{result.pnr}</strong></div><Status value={result.status}/></div><div className="detail-grid">{[['Passenger', result.name], ['Train', result.train], ['Coach / seat', `${result.coach} / ${result.seat}`], ['Journey date', result.date]].map(([label, text]) => <div key={label}><small>{label}</small><strong>{text}</strong></div>)}</div></div>}</section></>
}

function Medical({ notify }: { notify: (message: string) => void }) {
  const [requests, setRequests] = useState<MedicalRequest[]>([]); const [state, setState] = useState<LoadState>({ loading: true, error: '' }); const [pnr, setPnr] = useState(''); const [coach, setCoach] = useState(''); const [seat, setSeat] = useState(''); const [details, setDetails] = useState(''); const [priority, setPriority] = useState<MedicalRequest['priority']>('High')
  const load = useCallback(async () => { setState({ loading: true, error: '' }); try { setRequests((await medicalService.list()).map(medicalRow)); setState({ loading: false, error: '' }) } catch (error) { setState({ loading: false, error: message(error) }) } }, [])
  useEffect(() => { void load() }, [load])
  const ordered = [...requests].sort((a, b) => ['High', 'Medium', 'Normal'].indexOf(a.priority) - ['High', 'Medium', 'Normal'].indexOf(b.priority))
  const submit = async (event: FormEvent) => { event.preventDefault(); setState({ loading: true, error: '' }); try { await medicalService.create({ pnr, coach, seat, condition: details, priority: priority.toUpperCase() as 'HIGH' | 'MEDIUM' | 'NORMAL' }); setPnr(''); setCoach(''); setSeat(''); setDetails(''); await load(); notify('Assistance request recorded') } catch (error) { setState({ loading: false, error: message(error) }) } }
  const update = async (id: string, value: MedicalRequest['priority']) => { try { await medicalService.update(id, { priority: value.toUpperCase() as 'HIGH' | 'MEDIUM' | 'NORMAL' }); await load() } catch (error) { setState({ loading: false, error: message(error) }) } }
  const highCount = requests.filter(request => request.priority === 'High').length
  return <><PageHeading eyebrow="SAFETY / ONBOARD SUPPORT" title="Medical assistance" description="Record and track onboard support requests."/><ScreenNotice state={state} onRetry={() => void load()}/><div className="medical-layout"><section className="panel medical-form"><div className="panel-heading"><div><h2>New assistance request</h2><p>Link the request to an existing PNR.</p></div></div><form className="booking-form" onSubmit={event => void submit(event)}><label className="wide">PNR<input required value={pnr} onChange={event => setPnr(event.target.value.toUpperCase())} placeholder="Enter PNR"/></label><label>Coach<input required value={coach} onChange={event => setCoach(event.target.value.toUpperCase())}/></label><label>Seat<input required value={seat} onChange={event => setSeat(event.target.value)}/></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value as MedicalRequest['priority'])}><option>High</option><option>Medium</option><option>Normal</option></select></label><label className="wide">Condition / assistance needed<textarea required rows={3} value={details} onChange={event => setDetails(event.target.value)}/></label><div className="form-footer"><span/><Button type="submit" disabled={state.loading} icon={<HeartPulse size={16}/>}>Submit request</Button></div></form></section><section className="panel support-panel"><div className="panel-heading"><div><h2>Request overview</h2><p>Live onboard assistance workload</p></div></div><div className="medical-overview"><div><small>OPEN REQUESTS</small><strong>{requests.length}</strong></div><div><small>HIGH URGENCY</small><strong>{highCount}</strong></div><div><small>OTHER REQUESTS</small><strong>{requests.length - highCount}</strong></div></div><div className="medical-recent"><div className="medical-recent-heading"><h3>Recent activity</h3><span>{Math.min(ordered.length, 3)} latest</span></div>{ordered.slice(0, 3).map(request => <div className="medical-recent-row" key={request.id}><span className={`priority-mark ${request.priority.toLowerCase()}`}/><div><strong>{request.pnr}</strong><small>{request.coach} · Seat {request.seat}</small></div><span>{request.status}</span></div>)}{!ordered.length && !state.loading && <Empty text="No assistance requests"/>}</div></section></div><section className="panel medical-queue"><div className="panel-heading"><div><h2>Assistance requests</h2><p>Requests arranged by urgency</p></div></div>{ordered.map(request => <div className="medical-row" key={request.id}><span className={`priority-mark ${request.priority.toLowerCase()}`}/><div className="medical-row-main"><strong>{request.id} · {request.pnr}</strong><small>Coach {request.coach} · Seat {request.seat} · {request.details}</small></div><select value={request.priority} onChange={event => void update(request.id, event.target.value as MedicalRequest['priority'])}><option>High</option><option>Medium</option><option>Normal</option></select><Status value={request.status}/></div>)}</section></>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function ScreenNotice({ state, onRetry }: { state: LoadState; onRetry?: () => void }) { if (state.loading) return <div className="data-state" role="status">Loading live data…</div>; if (state.error) return <div className="data-state error-state" role="alert"><span>{state.error}</span>{onRetry && <button className="icon-button" title="Retry" aria-label="Retry request" onClick={onRetry}><RefreshCw size={15}/></button>}</div>; return null }
function Empty({ text }: { text: string }) { return <div className="empty-state"><CircleHelp size={19}/><span>{text}</span></div> }
function Button({ children, onClick, disabled, icon, type = 'button', variant = 'primary' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; icon?: React.ReactNode; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' }) { return <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled}>{icon}{children}</button> }
function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ size?: number }> }) { return <article className="panel stat-card"><div className="stat-top"><span>{label}</span><i><Icon size={16}/></i></div><strong className="stat-value">{value}</strong></article> }
function Status({ value }: { value: string }) { return <span className={`status-badge ${value.toLowerCase()}`}><i/>{value}</span> }
