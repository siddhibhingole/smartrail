import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as passengers from '../controllers/passengerController.js'
import { idParamSchema, partialPassengerSchema, passengerSchema } from '../validators/schemas.js'

const router=Router();router.use(requireAuth)
router.get('/',passengers.list)
router.post('/',validate(passengerSchema),passengers.create)
router.get('/:id',validate(idParamSchema),passengers.get)
router.put('/:id',validate(idParamSchema),validate(partialPassengerSchema),passengers.update)
export default router
