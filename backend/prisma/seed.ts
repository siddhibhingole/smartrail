import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const name = process.env.INITIAL_ADMIN_NAME?.trim()
  const password = process.env.INITIAL_ADMIN_PASSWORD
  const phone = process.env.INITIAL_ADMIN_PHONE?.trim()
  if (!email || !name || !password || password.length < 12) {
    throw new Error('Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, and INITIAL_ADMIN_PASSWORD (at least 12 characters) to provision the first administrator.')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: Role.ADMIN, ...(phone ? { phone } : {}) },
  })
  console.info(`Administrator account is ready for ${email}.`)
}

main().catch(error => {
  console.error('Administrator provisioning failed:', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
