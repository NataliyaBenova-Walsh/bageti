import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { prisma } from './db.js'
import { locationsRouter } from './routes/locations.js'
import { menuRouter } from './routes/menu.js'
import { ordersRouter } from './routes/orders.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

// Render sits behind one proxy; this lets rate limiting see the visitor's real IP
app.set('trust proxy', 1)

// The client is served from another domain in production (Vercel), so allow it.
// CLIENT_ORIGIN can list several origins separated by commas.
const clientOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim())
if (clientOrigins) app.use(cors({ origin: clientOrigins }))

app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'ok' })
  } catch {
    res.status(503).json({ status: 'ok', database: 'unreachable' })
  }
})

app.use('/api', menuRouter)
app.use('/api', locationsRouter)
app.use('/api', ordersRouter)

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

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
