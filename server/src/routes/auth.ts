import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { currentUser, endSession, hashPassword, startSession, verifyPassword } from '../auth.js'
import { prisma } from '../db.js'

export const authRouter = Router()

const loginInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
})

// Slows down password guessing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  // Off in automated tests, which send many requests from one address
  skip: () => process.env.NODE_ENV === 'test',
})

// Checked against when the email is unknown, so the reply takes as long as for a real account
const dummyHash = hashPassword(randomBytes(16).toString('hex'))

authRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const parsed = loginInput.safeParse(req.body)
  const user = parsed.success ? await prisma.user.findUnique({ where: { email: parsed.data.email } }) : null
  const passwordOk = parsed.success && (await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash)))
  // The same message whether the email or the password is wrong, so emails can't be discovered
  if (!user || !passwordOk) {
    res.status(401).json({ error: 'Wrong email or password' })
    return
  }
  await startSession(req, res, user)
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
})

authRouter.post('/auth/logout', (req, res) => {
  endSession(req, res)
  res.status(204).end()
})

authRouter.get('/auth/me', async (req, res) => {
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Not logged in' })
    return
  }
  res.json(user)
})
