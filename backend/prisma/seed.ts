import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, Role, SeatType, AllocationStatus, BookingStatus, PaymentMethod, PaymentStatus, TransactionStatus, TransactionType, WaitingStatus, MedicalPriority } from '@prisma/client'

const prisma=new PrismaClient()
const demoPassword='SmartRailDemo#2026'
const trains=[
 {trainNumber:'12951',trainName:'Mumbai Rajdhani',source:'Mumbai Central',destination:'New Delhi',departureTime:'16:35',arrivalTime:'08:35',duration:'16h 00m',baseFare:2145,stops:['Mumbai Central','Surat','Vadodara','New Delhi']},
 {trainNumber:'12009',trainName:'Shatabdi Express',source:'Mumbai Central',destination:'Ahmedabad',departureTime:'06:25',arrivalTime:'12:45',duration:'6h 20m',baseFare:980,stops:['Mumbai Central','Surat','Ahmedabad']},
 {trainNumber:'12123',trainName:'Deccan Queen',source:'Mumbai CSMT',destination:'Pune Jn',departureTime:'17:10',arrivalTime:'20:25',duration:'3h 15m',baseFare:640,stops:['Mumbai CSMT','Lonavala','Pune Jn']},
 {trainNumber:'12617',trainName:'Mangala Lakshadweep',source:'Mumbai LTT',destination:'Bengaluru',departureTime:'08:35',arrivalTime:'06:10',duration:'21h 35m',baseFare:1570,stops:['Mumbai LTT','Pune Jn','Hubballi','Bengaluru']},
 {trainNumber:'12903',trainName:'Golden Temple Mail',source:'Mumbai Central',destination:'Amritsar',departureTime:'18:45',arrivalTime:'21:20',duration:'26h 35m',baseFare:1810,stops:['Mumbai Central','Kota','New Delhi','Amritsar']},
]
const stations=new Map<string,string>()
function stationCode(name:string){const known:Record<string,string>={'Mumbai Central':'MMCT','Mumbai CSMT':'CSMT','New Delhi':'NDLS','Ahmedabad':'ADI','Pune Jn':'PUNE','Mumbai LTT':'LTT','Surat':'ST','Vadodara':'BRC','Lonavala':'LNL','Hubballi':'UBL','Bengaluru':'SBC','Kota':'KOTA','Amritsar':'ASR'};const code=known[name]??name.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase();stations.set(code,name);return code}
async function main(){
 const passwordHash=await bcrypt.hash(demoPassword,12)
 const admin=await prisma.user.upsert({where:{email:'admin@smartrail.demo'},update:{},create:{name:'SmartRail Admin',email:'admin@smartrail.demo',phone:'+91 90000 00001',passwordHash,role:Role.ADMIN}})
 const staff=await prisma.user.upsert({where:{email:'staff@smartrail.demo'},update:{},create:{name:'SmartRail Staff',email:'staff@smartrail.demo',phone:'+91 90000 00002',passwordHash,role:Role.STAFF}})
 const passengerUser=await prisma.user.upsert({where:{email:'passenger@smartrail.demo'},update:{},create:{name:'Siddhi Bhingole',email:'passenger@smartrail.demo',phone:'+91 90000 00003',passwordHash,role:Role.PASSENGER}})
 const trainRows=[]
 for(const item of trains){
  const trainData={trainNumber:item.trainNumber,trainName:item.trainName,source:item.source,destination:item.destination,departureTime:item.departureTime,arrivalTime:item.arrivalTime,duration:item.duration,baseFare:item.baseFare}
  const train=await prisma.train.upsert({where:{trainNumber:item.trainNumber},update:trainData,create:trainData})
  trainRows.push({train,item})
 }
 for(const {train,item} of trainRows){
  for(const [order,name] of item.stops.entries()){
   const code=stationCode(name)
   const station=await prisma.station.upsert({where:{code},update:{name,city:name},create:{code,name,city:name}})
   await prisma.trainRoute.upsert({where:{trainId_stopOrder:{trainId:train.id,stopOrder:order+1}},update:{stationId:station.id},create:{trainId:train.id,stationId:station.id,stopOrder:order+1}})
  }
  for(const coachNumber of ['A1','B1','B2','S1']){
   const coach=await prisma.coach.upsert({where:{trainId_coachNumber:{trainId:train.id,coachNumber}},update:{},create:{trainId:train.id,coachNumber,coachType:coachNumber.startsWith('A')?'AC 2 Tier':coachNumber.startsWith('B')?'AC 3 Tier':'Sleeper',capacity:24}})
   for(let n=1;n<=24;n++) await prisma.seat.upsert({where:{coachId_seatNumber:{coachId:coach.id,seatNumber:String(n)}},update:{},create:{coachId:coach.id,seatNumber:String(n),seatType:n%6===1||n%6===0?SeatType.WINDOW:n%6===2||n%6===5?SeatType.MIDDLE:SeatType.AISLE}})
  }
 }

 const mumbaiTrain=trainRows[0]!.train
 const journeyDate=new Date('2026-10-06T00:00:00.000Z')
 const coach=await prisma.coach.findUniqueOrThrow({where:{trainId_coachNumber:{trainId:mumbaiTrain.id,coachNumber:'B2'}}})
 const seat=await prisma.seat.findUniqueOrThrow({where:{coachId_seatNumber:{coachId:coach.id,seatNumber:'18'}}})
 const passenger=await prisma.passenger.findFirst({where:{userId:passengerUser.id,fullName:'Aarav Mehta'}}) ?? await prisma.passenger.create({data:{userId:passengerUser.id,fullName:'Aarav Mehta',age:28,gender:'MALE',phone:'+91 90000 12018',idType:'Demo ID',idNumber:'DEMO-001'}})
 const booking=await prisma.booking.upsert({where:{pnr:'SR458921'},update:{},create:{pnr:'SR458921',userId:passengerUser.id,trainId:mumbaiTrain.id,journeyDate,status:BookingStatus.CONFIRMED,totalAmount:2145}})
 const bp=await prisma.bookingPassenger.findFirst({where:{bookingId:booking.id,passengerId:passenger.id}}) ?? await prisma.bookingPassenger.create({data:{bookingId:booking.id,passengerId:passenger.id,position:0,seatId:seat.id,coachId:coach.id,fare:2145,seatPreference:SeatType.WINDOW}})
 const allocation=await prisma.seatAllocation.upsert({where:{seatId_journeyDate:{seatId:seat.id,journeyDate}},update:{status:AllocationStatus.BOOKED,bookingPassengerId:bp.id},create:{seatId:seat.id,journeyDate,status:AllocationStatus.BOOKED,bookingPassengerId:bp.id}})
 const bookingTxn=await prisma.transaction.upsert({where:{referenceId:'SEED-BOOK-SR458921'},update:{},create:{userId:passengerUser.id,bookingId:booking.id,type:TransactionType.BOOKING,status:TransactionStatus.SUCCESS,amount:2145,paymentMethod:PaymentMethod.UPI,referenceId:'SEED-BOOK-SR458921'}})
 await prisma.payment.upsert({where:{bookingId:booking.id},update:{},create:{bookingId:booking.id,transactionId:bookingTxn.id,amount:2145,paymentMethod:PaymentMethod.UPI,status:PaymentStatus.SUCCESS,gatewayReference:'MOCK-SEED-SUCCESS'}})
 await prisma.undoTransaction.upsert({where:{transactionId:bookingTxn.id},update:{},create:{userId:passengerUser.id,transactionId:bookingTxn.id,operation:'BOOKING',payload:{bookingId:booking.id,allocationId:allocation.id}}})
 await prisma.medicalRequest.upsert({where:{id:'seed-med-041'},update:{},create:{id:'seed-med-041',userId:passengerUser.id,pnr:booking.pnr,coach:'B2',seat:'18',condition:'Passenger feeling unwell',contact:'+91 90000 12018',priority:MedicalPriority.HIGH,status:'ACKNOWLEDGED'}})

 const waitTrain=trainRows[2]!.train
 const waitingPassenger=await prisma.passenger.findFirst({where:{userId:passengerUser.id,fullName:'Kabir Rao'}}) ?? await prisma.passenger.create({data:{userId:passengerUser.id,fullName:'Kabir Rao',age:22,gender:'MALE',phone:'+91 90000 22017'}})
 const waitingBooking=await prisma.booking.upsert({where:{pnr:'SR920147'},update:{},create:{pnr:'SR920147',userId:passengerUser.id,trainId:waitTrain.id,journeyDate,status:BookingStatus.WAITING,totalAmount:640}})
 await prisma.bookingPassenger.findFirst({where:{bookingId:waitingBooking.id,passengerId:waitingPassenger.id}}) ?? await prisma.bookingPassenger.create({data:{bookingId:waitingBooking.id,passengerId:waitingPassenger.id,position:0,fare:640}})
 await prisma.waitingList.upsert({where:{bookingId:waitingBooking.id},update:{},create:{bookingId:waitingBooking.id,position:1,status:WaitingStatus.WAITING}})
 await prisma.transaction.upsert({where:{referenceId:'SEED-WAIT-SR920147'},update:{},create:{userId:passengerUser.id,bookingId:waitingBooking.id,type:TransactionType.BOOKING,status:TransactionStatus.SUCCESS,amount:0,referenceId:'SEED-WAIT-SR920147'}})
 await prisma.auditLog.create({data:{userId:admin.id,action:'DEMO_DATA_SEEDED',entity:'Train',metadata:{trainCount:trainRows.length,staffId:staff.id,stations:[...stations.keys()]}}})
 console.info(`Seeded ${trainRows.length} trains, demo accounts, bookings and medical support data.`)
}
main().catch(error=>{console.error('SmartRail seed failed',error instanceof Error?error.message:'unknown');process.exitCode=1}).finally(()=>prisma.$disconnect())
