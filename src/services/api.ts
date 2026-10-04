const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
const TOKEN_KEY = 'smartrail-access-token'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'ApiError' }
}
export class ApiUnavailableError extends ApiError {
  constructor() { super(503, 'API_UNAVAILABLE', 'The SmartRail API is not reachable. Check the connection and try again.') }
}

export function getAccessToken() { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY) }
function saveAccessToken(token: string | null) { if (typeof sessionStorage !== 'undefined') token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY) }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token=getAccessToken()
  let response: Response
  try { response=await fetch(`${API_URL}${path}`,{...init,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} : {}),...init.headers}}) }
  catch { throw new ApiUnavailableError() }
  let payload: {success:boolean;data?:T;error?:{code:string;message:string}}
  try { payload=await response.json() as typeof payload } catch { throw new ApiError(response.status,'INVALID_RESPONSE','The API returned an unreadable response.') }
  if(!response.ok||!payload.success)throw new ApiError(response.status,payload.error?.code??'API_ERROR',payload.error?.message??'The request could not be completed.')
  return payload.data as T
}
const json=(body:unknown):RequestInit=>({method:'POST',body:JSON.stringify(body)})

export const authService={
  async login(email:string,password:string){const result=await request<{accessToken:string;user:ApiUser}>('/auth/login',json({email,password}));saveAccessToken(result.accessToken);return result},
  async register(data:{name:string;email:string;phone?:string;password:string}){const result=await request<{accessToken:string;user:ApiUser}>('/auth/register',json(data));saveAccessToken(result.accessToken);return result},
  me:()=>request<ApiUser>('/auth/me'),
  signOut(){saveAccessToken(null)},
}
export const systemService={health:()=>request<{status:string;database:string;service:string}>('/health')}
export type ApiUser={id:string;name:string;email:string;phone?:string|null;role:'PASSENGER'|'ADMIN'|'STAFF'}
export type TravelClass='ALL'|'1A'|'2A'|'3A'|'SL'|'CC'
export type ApiHoldInput={trainId:string;journeyDate:string;passengerCount:number;seatPreference?:'WINDOW'|'MIDDLE'|'AISLE';seatIds?:string[];groupBooking:boolean;travelClass?:TravelClass}
export const trainService={list:(query?:{from?:string;to?:string;q?:string})=>request<ApiTrain[]>(`/trains${query?`?${new URLSearchParams(query)}`:''}`),get:(id:string)=>request<ApiTrain>(`/trains/${encodeURIComponent(id)}`),seats:(id:string,date:string,travelClass:TravelClass='ALL')=>request<ApiSeatMap>(`/trains/${encodeURIComponent(id)}/seats?date=${encodeURIComponent(date)}&travelClass=${travelClass}`),hold:(data:ApiHoldInput)=>request<ApiSeatHold>('/trains/seats/hold',json(data)),release:(holdToken:string)=>request<{released:number}>('/trains/seats/release',json({holdToken}))}
export type ApiTrain={id:string;trainNumber:string;trainName:string;source:string;destination:string;departureTime:string;arrivalTime:string;duration:string;baseFare:string|number;coaches?:Array<{coachNumber:string;coachType:string;_count?:{seats:number}} >}
export type ApiSeat={id:string;coach:string;coachType:string;seatNumber:string;seatType:'WINDOW'|'MIDDLE'|'AISLE';status:'AVAILABLE'|'UNAVAILABLE'}
export type ApiSeatMap={train:{id:string;trainNumber:string;trainName:string};journeyDate:string;seats:ApiSeat[]}
export type ApiSeatHold={holdToken:string;heldUntil:string;allocationStatus:string;seats:Array<{coach:string;seatNumber:string;seatType:string;allocationReason:string}>}
export type ApiPassengerInput={fullName:string;age:number;gender:'FEMALE'|'MALE'|'NON_BINARY'|'UNDISCLOSED';phone?:string;seatPreference?:'WINDOW'|'MIDDLE'|'AISLE'}
export type ApiBookingInput={trainId:string;journeyDate:string;passengers:ApiPassengerInput[];seatPreference?:'WINDOW'|'MIDDLE'|'AISLE';seatIds?:string[];groupBooking:boolean;quota?:'GENERAL'|'TATKAL'|'LADIES'|'SENIOR_CITIZEN';travelClass?:TravelClass;paymentMethod:'UPI'|'CARD'|'NET_BANKING'|'WALLET'|'CASH';idempotencyKey:string}
export const bookingService={create:(data:ApiBookingInput)=>request<ApiBooking>('/bookings',json(data)),list:()=>request<ApiBooking[]>('/bookings'),get:(id:string)=>request<ApiBooking>(`/bookings/${encodeURIComponent(id)}`),pnr:(pnr:string)=>request<ApiBooking>(`/bookings/pnr/${encodeURIComponent(pnr)}`),cancel:(id:string)=>request<ApiCancellation>(`/bookings/${encodeURIComponent(id)}/cancel`,json({}))}
export type ApiBooking={id:string;pnr:string;status:'PENDING'|'CONFIRMED'|'WAITING'|'CANCELLED'|'FAILED';journeyDate:string;totalAmount:string|number;quota?:'GENERAL'|'TATKAL'|'LADIES'|'SENIOR_CITIZEN';travelClass?:TravelClass;train:{id:string;trainNumber:string;trainName:string};passengers:Array<{passenger:{id:string;fullName:string;age:number};seat?:{seatNumber:string}|null;coach?:{coachNumber:string}|null}>;payment?:{id:string;status:string;paymentMethod:string}|null;allocationStatus?:string;waitingPosition?:number}
export type ApiCancellation={bookingId:string;status:string;refund?:{transactionId:string;status:string}|null;promotedBookingId?:string|null;undoAvailable:boolean}
export const paymentService={process:(bookingId:string)=>request<unknown>('/payments/process',json({bookingId})),get:(id:string)=>request<unknown>(`/payments/${encodeURIComponent(id)}`)}
export const transactionService={list:(filters?:Record<string,string>)=>request<ApiTransaction[]>(`/transactions${filters?`?${new URLSearchParams(filters)}`:''}`),get:(id:string)=>request<ApiTransaction>(`/transactions/${encodeURIComponent(id)}`),undo:()=>request<unknown>('/transactions/undo',json({}))}
export type ApiTransaction={id:string;type:string;status:string;amount:string|number;paymentMethod?:string|null;referenceId:string;createdAt:string;booking?:{pnr:string;status:string}|null;payment?:{status:string;paymentMethod:string;amount:string|number}|null}
export type ApiWaitingEntry={id:string;position:number;status:string;bookingId:string;booking:{id:string;pnr:string;status:string;journeyDate:string;train:{trainNumber:string;trainName:string};passengers:Array<{passenger:{fullName:string;age:number}}>}}
export const waitingListService={list:()=>request<ApiWaitingEntry[]>('/waiting-list'),join:(bookingId:string)=>request<ApiWaitingEntry>('/waiting-list',json({bookingId})),promote:(id:string)=>request<{bookingId:string;pnr:string;status:string}>(`/waiting-list/${encodeURIComponent(id)}/promote`,json({}))}
export type ApiMedicalRequest={id:string;pnr:string;coach:string;seat:string;condition:string;priority:'HIGH'|'MEDIUM'|'NORMAL';status:'REQUESTED'|'ACKNOWLEDGED'|'RESOLVED';createdAt:string}
export const medicalService={list:()=>request<ApiMedicalRequest[]>('/medical-requests'),create:(data:{pnr:string;coach:string;seat:string;condition:string;priority:ApiMedicalRequest['priority']})=>request<ApiMedicalRequest>('/medical-requests',json(data)),update:(id:string,data:Partial<Pick<ApiMedicalRequest,'priority'|'status'>>)=>request<ApiMedicalRequest>(`/medical-requests/${encodeURIComponent(id)}/priority`,{method:'PATCH',body:JSON.stringify(data)})}
export type ApiPassengerRecord={id:string;fullName:string;age:number;gender:string;phone?:string|null;bookingPassengers?:Array<{booking:{id:string;pnr:string;status:string;journeyDate:string;train:{trainNumber:string;trainName:string}};seat?:{seatNumber:string}|null;coach?:{coachNumber:string}|null}>}
export const passengerService={list:()=>request<ApiPassengerRecord[]>('/passengers'),get:(id:string)=>request<ApiPassengerRecord>(`/passengers/${encodeURIComponent(id)}`),create:(data:{fullName:string;age:number;gender:'FEMALE'|'MALE'|'NON_BINARY'|'UNDISCLOSED';phone?:string})=>request<ApiPassengerRecord>('/passengers',json(data)),update:(id:string,data:Partial<{fullName:string;age:number;gender:'FEMALE'|'MALE'|'NON_BINARY'|'UNDISCLOSED';phone:string}>)=>request<ApiPassengerRecord>(`/passengers/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(data)})}
export type ApiAnalyticsOccupancy={totalSeats:number;occupiedSeats:number;heldSeats:number;availableSeats:number;waitingPassengers:number;confirmedBookings:number;occupancyPercent:number}
export type ApiAnalyticsBookings={total:number;confirmed:number;cancelled:number;waiting:number;failed:number;byStatus:Array<{status:string;count:number}>}
export type ApiAnalyticsRevenue={revenue:number|string;refunds:number|string}
export const analyticsService={occupancy:()=>request<ApiAnalyticsOccupancy>('/analytics/occupancy'),bookings:()=>request<ApiAnalyticsBookings>('/analytics/bookings'),revenue:()=>request<ApiAnalyticsRevenue>('/analytics/revenue')}
