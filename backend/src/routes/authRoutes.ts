import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, me, register } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema } from '../validators/schemas.js'

const router=Router()
const authLimit=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{code:'RATE_LIMITED',message:'Too many authentication attempts. Try again later.'}}})
router.post('/register',authLimit,validate(registerSchema),register)
router.post('/login',authLimit,validate(loginSchema),login)
router.get('/me',requireAuth,me)
export default router
