import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/http.js'

const publicUser = (user: { id: string; name: string; email: string; phone: string | null; role: string }) => ({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role })
export const authService = {
  async register(data: { name: string; email: string; phone?: string; password: string }) {
    const passwordHash = await bcrypt.hash(data.password, 12)
    try { const user = await prisma.user.create({ data: { name: data.name, email: data.email.toLowerCase(), phone: data.phone, passwordHash } }); return { user: publicUser(user), accessToken: this.token(user.id, user.role) } }
    catch (error) { if (isUnique(error)) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.'); throw error }
  },
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
    return { user: publicUser(user), accessToken: this.token(user.id, user.role) }
  },
  async me(id: string) { const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, role: true } }); if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.'); return user },
  token(id: string, role: string) { return jwt.sign({ role }, env.JWT_SECRET, { subject: id, expiresIn: '8h', issuer: 'smartrail-api', audience: 'smartrail-client' }) },
}
function isUnique(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002' }
