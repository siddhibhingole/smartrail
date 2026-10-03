import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as bookings from '../controllers/bookingController.js'
import { bookingSchema, idParamSchema } from '../validators/schemas.js'

const router=Router()
router.use(requireAuth)
router.post('/',validate(bookingSchema),bookings.create)
router.get('/',bookings.list)
router.get('/pnr/:pnr',bookings.byPnr)
router.get('/:id',validate(idParamSchema),bookings.get)
router.post('/:id/cancel',validate(idParamSchema),bookings.cancel)
export default router
