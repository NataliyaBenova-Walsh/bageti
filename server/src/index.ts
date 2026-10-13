import cors from 'cors'
import express from 'express'
import { prisma } from './db.js'
import { menuRouter } from './routes/menu.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

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

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
