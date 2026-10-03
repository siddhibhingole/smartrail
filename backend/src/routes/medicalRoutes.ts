import { Router } from 'express'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as medical from '../controllers/medicalController.js'
import { idParamSchema, medicalSchema, medicalUpdateSchema } from '../validators/schemas.js'

const router=Router();router.use(requireAuth)
router.post('/',validate(medicalSchema),medical.create)
router.get('/',medical.list)
router.patch('/:id/priority',allowRoles('ADMIN','STAFF'),validate(idParamSchema),validate(medicalUpdateSchema),medical.update)
router.patch('/:id/status',allowRoles('ADMIN','STAFF'),validate(idParamSchema),validate(medicalUpdateSchema),medical.update)
export default router
