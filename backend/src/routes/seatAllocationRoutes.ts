import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { holdSchema } from '../validators/schemas.js'
import { hold } from '../controllers/trainController.js'

const router=Router()
router.post('/',requireAuth,validate(holdSchema),hold)
export default router
