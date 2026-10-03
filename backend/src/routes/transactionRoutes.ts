import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as transactions from '../controllers/transactionController.js'
import { idParamSchema } from '../validators/schemas.js'

const router=Router();router.use(requireAuth)
router.get('/',transactions.list)
router.get('/:id',validate(idParamSchema),transactions.get)
router.post('/undo',transactions.undo)
export default router
