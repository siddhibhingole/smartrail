import 'dotenv/config'
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { seatService } from './services/seatService.js'
import { bookingService } from './services/bookingService.js'

const server=app.listen(env.PORT,()=>console.info(`SmartRail API listening on port ${env.PORT}`))
const cleanup=setInterval(()=>{void prisma.$transaction(async tx=>{await bookingService.expireUnpaidPayments(tx);await seatService.releaseExpired(tx)}).catch(()=>console.warn('Expired hold cleanup failed; database is unavailable.'))},60_000)
cleanup.unref()

async function shutdown(){clearInterval(cleanup);server.close(()=>{void prisma.$disconnect().finally(()=>process.exit(0))})}
process.on('SIGINT',()=>void shutdown())
process.on('SIGTERM',()=>void shutdown())
