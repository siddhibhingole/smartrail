import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as payments from '../controllers/paymentController.js'
import { paymentSchema, idParamSchema } from '../validators/schemas.js'

const router=Router();router.use(requireAuth)
router.post('/process',validate(paymentSchema),payments.process)
router.get('/:id',validate(idParamSchema),payments.get)
export default router
