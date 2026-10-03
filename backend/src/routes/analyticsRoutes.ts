import { Router } from 'express'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import * as analytics from '../controllers/analyticsController.js'

const router=Router();router.use(requireAuth,allowRoles('ADMIN','STAFF'))
router.get('/occupancy',analytics.occupancy)
router.get('/bookings',analytics.bookings)
router.get('/revenue',analytics.revenue)
export default router
