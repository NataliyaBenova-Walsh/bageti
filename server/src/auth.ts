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

// Lets the request through only for a logged-in user with one of these roles
export function requireRole(...roles: Role[]): RequestHandler {
  return async (req, res, next) => {
    const user = await currentUser(req)
    if (!user) {
      res.status(401).json({ error: 'Please log in' })
      return
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'Your account is not allowed to do this' })
      return
    }
    res.locals.user = user
    next()
  }
}

// Creates an account, or updates its role and password if they've changed
async function ensureAccount(email: string, password: string, role: Role, name: string) {
  email = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) {
    await prisma.user.create({ data: { email, name, role, passwordHash: await hashPassword(password) } })
    console.log(`Created ${role} account ${email}`)
  } else if (existing.role !== role || !(await verifyPassword(password, existing.passwordHash))) {
    await prisma.user.update({ where: { id: existing.id }, data: { role, passwordHash: await hashPassword(password) } })
    console.log(`Updated ${role} account ${email}`)
  }
}

// Runs when the server starts. ADMIN_EMAIL and ADMIN_PASSWORD give full access;
// DEMO_EMAIL and DEMO_PASSWORD are the public demo login, with the staff role.
export async function ensureAccounts() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD } = process.env
  if (ADMIN_EMAIL && ADMIN_PASSWORD) await ensureAccount(ADMIN_EMAIL, ADMIN_PASSWORD, 'ADMIN', 'Admin')
  else console.warn('ADMIN_EMAIL or ADMIN_PASSWORD is not set: no admin account created')
  if (DEMO_EMAIL && DEMO_PASSWORD) await ensureAccount(DEMO_EMAIL, DEMO_PASSWORD, 'STAFF', 'Demo staff')
}
