import { Router } from 'express'
import { prisma } from '../db.js'
import { pickupSlots } from '../pickup.js'

export const locationsRouter = Router()

locationsRouter.get('/locations', async (_req, res) => {
  const locations = await prisma.location.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, address: true, opensAt: true, closesAt: true },
  })
  res.json(locations)
})

// Bookable pickup times for one shop, grouped by day
locationsRouter.get('/locations/:id/pickup-slots', async (req, res) => {
  const location = await prisma.location.findUnique({ where: { id: req.params.id } })
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }
  res.json(pickupSlots(location, new Date()))
})
