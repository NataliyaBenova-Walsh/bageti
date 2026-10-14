import { readFileSync } from 'node:fs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import swaggerUi from 'swagger-ui-express'
import { parse } from 'yaml'
import { prisma } from './db.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { locationsRouter } from './routes/locations.js'
import { menuRouter } from './routes/menu.js'
import { ordersRouter } from './routes/orders.js'

// The Express app, without starting it, so tests can send requests to it directly
export const app = express()

// Requests come through two proxies: Vercel (which forwards /api to Render) and Render's own.
// Trusting both lets rate limiting see the visitor's real IP and req.secure see HTTPS.
app.set('trust proxy', 2)

// The client is served from another domain in production (Vercel), so allow it.
// CLIENT_ORIGIN can list several origins separated by commas.
const clientOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim())
if (clientOrigins) app.use(cors({ origin: clientOrigins }))

app.use(express.json())
app.use(cookieParser())

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'ok' })
  } catch {
    res.status(503).json({ status: 'ok', database: 'unreachable' })
  }
})

// API documentation: the OpenAPI description, and an interactive page to read and try it
export const openapi = parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'))
app.get('/api/openapi.json', (_req, res) => {
  res.json(openapi)
})
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Fika Bakery API' }))

app.use('/api', menuRouter)
app.use('/api', locationsRouter)
app.use('/api', ordersRouter)
app.use('/api', authRouter)
app.use('/api', adminRouter)

// Errors thrown in routes: log them, and answer in JSON instead of Express's HTML page
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error)
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Request body is not valid JSON' })
    return
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
app.use(errorHandler)
