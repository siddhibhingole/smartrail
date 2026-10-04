import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes.js'
import trainRoutes from './routes/trainRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import medicalRoutes from './routes/medicalRoutes.js'
import passengerRoutes from './routes/passengerRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import waitingRoutes from './routes/waitingRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import seatAllocationRoutes from './routes/seatAllocationRoutes.js'
import { errorHandler } from './middleware/errors.js'
import { env } from './config/env.js'
import { prisma } from './config/prisma.js'

export const app=express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({origin:env.FRONTEND_URL.split(',').map(origin=>origin.trim()),credentials:true}))
app.use(express.json({limit:'64kb'}))
const health=async(_req:express.Request,res:express.Response)=>{try{await prisma.$queryRaw`SELECT 1`;res.json({success:true,data:{status:'ok',database:'connected',service:'smartrail-api'}})}catch{res.status(503).json({success:false,error:{code:'DATABASE_UNAVAILABLE',message:'The database is not reachable.'}})}}
app.get('/health',health)
app.get('/api/health',health)
app.use('/api/auth',authRoutes)
app.use('/api/trains',trainRoutes)
app.use('/api/bookings',bookingRoutes)
app.use('/api/medical-requests',medicalRoutes)
app.use('/api/passengers',passengerRoutes)
app.use('/api/payments',paymentRoutes)
app.use('/api/transactions',transactionRoutes)
app.use('/api/waiting-list',waitingRoutes)
app.use('/api/analytics',analyticsRoutes)
app.use('/api/seat-allocation',seatAllocationRoutes)
app.use((_req,res)=>res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'API route not found.'}}))
app.use(errorHandler)
