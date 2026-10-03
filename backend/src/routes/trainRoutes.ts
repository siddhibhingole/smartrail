import { Router } from 'express'
import { allowRoles, requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as trains from '../controllers/trainController.js'
import { holdSchema, holdReleaseSchema, partialTrainSchema, trainSchema, trainSearchSchema } from '../validators/schemas.js'

const router=Router()
router.get('/',validate(trainSearchSchema),trains.list)
router.get('/search',validate(trainSearchSchema),trains.list)
router.post('/',requireAuth,allowRoles('ADMIN'),validate(trainSchema),trains.create)
router.post('/seats/hold',requireAuth,validate(holdSchema),trains.hold)
router.post('/seats/release',requireAuth,validate(holdReleaseSchema),trains.release)
router.get('/:id/seats',trains.seats)
router.get('/:id',trains.get)
router.put('/:id',requireAuth,allowRoles('ADMIN'),validate(partialTrainSchema),trains.update)
router.delete('/:id',requireAuth,allowRoles('ADMIN'),trains.remove)
export default router
