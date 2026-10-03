import { Router } from 'express'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as waiting from '../controllers/waitingController.js'
import { idParamSchema, waitingSchema } from '../validators/schemas.js'

const router=Router();router.use(requireAuth)
router.get('/',waiting.list)
router.post('/',validate(waitingSchema),waiting.join)
router.post('/:id/promote',allowRoles('ADMIN','STAFF'),validate(idParamSchema),waiting.promote)
export default router
