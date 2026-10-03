import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/http.js'

const safeSelect = { id:true, userId:true, fullName:true, age:true, gender:true, phone:true, createdAt:true, updatedAt:true } as const
export const passengerService = {
  list(userId:string,role:string) { return prisma.passenger.findMany({where:role==='PASSENGER'?{userId}: {},select:safeSelect,orderBy:{createdAt:'desc'},take:300}) },
  async get(id:string,userId:string,role:string) { const p=await prisma.passenger.findUnique({where:{id},select:{...safeSelect,bookingPassengers:{include:{booking:{select:{pnr:true,status:true,journeyDate:true,train:{select:{trainNumber:true,trainName:true}}}},seat:{select:{seatNumber:true,seatType:true}},coach:{select:{coachNumber:true}}}}}});if(!p)throw new AppError(404,'PASSENGER_NOT_FOUND','Passenger not found.');if(role==='PASSENGER'&&p.userId!==userId)throw new AppError(403,'FORBIDDEN','You cannot view this passenger record.');return p },
  create(data:{fullName:string;age:number;gender:'FEMALE'|'MALE'|'NON_BINARY'|'UNDISCLOSED';phone?:string;idType?:string;idNumber?:string},userId:string){return prisma.passenger.create({data:{...data,userId},select:safeSelect})},
  async update(id:string,data:Partial<{fullName:string;age:number;gender:'FEMALE'|'MALE'|'NON_BINARY'|'UNDISCLOSED';phone:string;idType:string;idNumber:string}>,userId:string,role:string){const p=await prisma.passenger.findUnique({where:{id},select:{id:true,userId:true}});if(!p)throw new AppError(404,'PASSENGER_NOT_FOUND','Passenger not found.');if(role==='PASSENGER'&&p.userId!==userId)throw new AppError(403,'FORBIDDEN','You cannot update this passenger record.');return prisma.passenger.update({where:{id},data,select:safeSelect})},
}
