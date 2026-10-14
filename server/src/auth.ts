import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { CookieOptions, Request, RequestHandler, Response } from 'express'
import { jwtVerify, SignJWT } from 'jose'
import { prisma } from './db.js'
import type { Role } from './generated/prisma/client.js'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

// Stored as "scrypt$<salt>$<hash>", both base64
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

// Without JWT_SECRET (local development only) a random one is used,
// so logins end whenever the server restarts.
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set: using a temporary secret')
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? randomBytes(32).toString('hex'))

const COOKIE_NAME = 'fika_session'
const SESSION_DAYS = 7

function cookieOptions(req: Request): CookieOptions {
  // req.secure is true behind Render's HTTPS proxy (see 'trust proxy'), false on localhost
  return { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' }
}

export async function startSession(req: Request, res: Response, user: { id: number; role: Role }) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret)
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(req), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 })
}

export function endSession(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions(req))
}

// The signed-in user, or null if there's no valid session cookie
export async function currentUser(req: Request) {
  const token: unknown = req.cookies?.[COOKIE_NAME]
  if (typeof token !== 'string') return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    // Read the user again, so a deleted account or changed role takes effect at once
    return await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, email: true, name: true, role: true },
    })
  } catch {
    return null
  }
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Please log in' })
    return
  }
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admins only' })
    return
  }
  res.locals.user = user
  next()
}

// Creates the admin account from ADMIN_EMAIL and ADMIN_PASSWORD, or updates
// its password if ADMIN_PASSWORD has changed. Runs when the server starts.
export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.warn('ADMIN_EMAIL or ADMIN_PASSWORD is not set: no admin account created')
    return
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) {
    await prisma.user.create({ data: { email, name: 'Admin', role: 'ADMIN', passwordHash: await hashPassword(password) } })
    console.log(`Created admin account ${email}`)
  } else if (existing.role !== 'ADMIN' || !(await verifyPassword(password, existing.passwordHash))) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', passwordHash: await hashPassword(password) },
    })
    console.log(`Updated admin account ${email}`)
  }
}
