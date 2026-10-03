const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
const TOKEN_KEY = 'smartrail-access-token'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'ApiError' }
}

export function getAccessToken() { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY) }
function saveAccessToken(token: string | null) { if (typeof sessionStorage !== 'undefined') token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY) }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token=getAccessToken()
  const response=await fetch(`${API_URL}${path}`,{...init,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} : {}),...init.headers}})
  const payload=await response.json() as {success:boolean;data?:T;error?:{code:string;message:string}}
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
export type ApiUser={id:string;name:string;email:string;phone?:string|null;role:'PASSENGER'|'ADMIN'|'STAFF'}
export const trainService={list:(query?:{from?:string;to?:string;q?:string})=>request<ApiTrain[]>(`/trains${query?`?${new URLSearchParams(query)}`:''}`),get:(id:string)=>request<ApiTrain>(`/trains/${encodeURIComponent(id)}`),seats:(id:string,date:string)=>request<ApiSeatMap>(`/trains/${encodeURIComponent(id)}/seats?date=${encodeURIComponent(date)}`),hold:(data:unknown)=>request<ApiSeatHold>('/trains/seats/hold',json(data)),release:(holdToken:string)=>request<{released:number}>('/trains/seats/release',json({holdToken}))}
export type ApiTrain={id:string;trainNumber:string;trainName:string;source:string;destination:string;departureTime:string;arrivalTime:string;duration:string;baseFare:string|number;coaches?:Array<{coachNumber:string;coachType:string;_count?:{seats:number}} >}
export type ApiSeat={coach:string;coachType:string;seatNumber:string;seatType:'WINDOW'|'MIDDLE'|'AISLE';status:'AVAILABLE'|'UNAVAILABLE'}
export type ApiSeatMap={train:{id:string;trainNumber:string;trainName:string};journeyDate:string;seats:ApiSeat[]}
export type ApiSeatHold={holdToken:string;heldUntil:string;allocationStatus:string;seats:Array<{coach:string;seatNumber:string;seatType:string;allocationReason:string}>}
export const bookingService={create:(data:unknown)=>request<ApiBooking>('/bookings',json(data)),list:()=>request<ApiBooking[]>('/bookings'),get:(id:string)=>request<ApiBooking>(`/bookings/${encodeURIComponent(id)}`),pnr:(pnr:string)=>request<ApiBooking>(`/bookings/pnr/${encodeURIComponent(pnr)}`),cancel:(id:string)=>request<ApiCancellation>(`/bookings/${encodeURIComponent(id)}/cancel`,json({}))}
export type ApiBooking={id:string;pnr:string;status:'PENDING'|'CONFIRMED'|'WAITING'|'CANCELLED'|'FAILED';journeyDate:string;totalAmount:string|number;train:{id:string;trainNumber:string;trainName:string};passengers:Array<{passenger:{id:string;fullName:string;age:number};seat?:{seatNumber:string}|null;coach?:{coachNumber:string}|null}>;payment?:{id:string;status:string;paymentMethod:string}|null;allocationStatus?:string;waitingPosition?:number}
export type ApiCancellation={bookingId:string;status:string;refund?:{transactionId:string;status:string}|null;promotedBookingId?:string|null;undoAvailable:boolean}
export const paymentService={process:(bookingId:string)=>request<unknown>('/payments/process',json({bookingId})),get:(id:string)=>request<unknown>(`/payments/${encodeURIComponent(id)}`)}
export const transactionService={list:(filters?:Record<string,string>)=>request<ApiTransaction[]>(`/transactions${filters?`?${new URLSearchParams(filters)}`:''}`),get:(id:string)=>request<ApiTransaction>(`/transactions/${encodeURIComponent(id)}`),undo:()=>request<unknown>('/transactions/undo',json({}))}
export type ApiTransaction={id:string;type:string;status:string;amount:string|number;paymentMethod?:string|null;referenceId:string;createdAt:string;booking?:{pnr:string;status:string}|null;payment?:{status:string;paymentMethod:string;amount:string|number}|null}
export const waitingListService={list:()=>request<unknown[]>('/waiting-list'),join:(bookingId:string)=>request<unknown>('/waiting-list',json({bookingId})),promote:(id:string)=>request<unknown>(`/waiting-list/${encodeURIComponent(id)}/promote`,json({}))}
export const medicalService={list:()=>request<unknown[]>('/medical-requests'),create:(data:unknown)=>request<unknown>('/medical-requests',json(data)),update:(id:string,data:unknown)=>request<unknown>(`/medical-requests/${encodeURIComponent(id)}/priority`,{method:'PATCH',body:JSON.stringify(data)})}
export const passengerService={list:()=>request<unknown[]>('/passengers'),get:(id:string)=>request<unknown>(`/passengers/${encodeURIComponent(id)}`),create:(data:unknown)=>request<unknown>('/passengers',json(data)),update:(id:string,data:unknown)=>request<unknown>(`/passengers/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(data)})}
export const analyticsService={occupancy:()=>request<unknown>('/analytics/occupancy'),bookings:()=>request<unknown>('/analytics/bookings'),revenue:()=>request<unknown>('/analytics/revenue')}
