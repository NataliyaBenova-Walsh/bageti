import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../auth.js'
import { prisma } from '../db.js'
import { shopDayRange, shopToday } from '../pickup.js'

export const salesRouter = Router()

// The demo login has the staff role, so staff can see the figures too: it's a demo shop
const staffOrAdmin = requireRole('STAFF', 'ADMIN')

const MAX_DAYS = 366
const TOP_PRODUCTS = 8

const salesQuery = z.object({
  // Swedish dates, "YYYY-MM-DD", both included
  from: z.iso.date(),
  to: z.iso.date(),
  location: z.string().optional(),
})

// "2026-10-15" plus n days, by the calendar (no time zones involved)
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1

// Orders that count as sales: placed and not cancelled. Card orders still waiting for
// payment don't count until they're paid. Days are pickup days in Swedish time.
function salesOrders(from: string, to: string, locationId?: string) {
  return prisma.order.findMany({
    where: {
      pickupAt: { gte: shopDayRange(from).start, lt: shopDayRange(to).end },
      locationId,
      status: { not: 'CANCELLED' },
      paymentStatus: { not: 'AWAITING_PAYMENT' },
    },
    select: {
      pickupAt: true,
      totalCents: true,
      locationId: true,
      items: { select: { productId: true, name: true, unitPriceCents: true, quantity: true } },
    },
  })
}

salesRouter.get('/admin/sales', staffOrAdmin, async (req, res) => {
  const parsed = salesQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Please choose a valid date range' })
    return
  }
  const { from, to, location } = parsed.data
  const days = daysBetween(from, to)
  if (days < 1 || days > MAX_DAYS) {
    res.status(400).json({ error: `The range must be 1 to ${MAX_DAYS} days, with "from" before "to"` })
    return
  }

  // The same number of days just before, for the comparison
  const previousFrom = addDays(from, -days)
  const previousTo = addDays(from, -1)
  const [orders, previousOrders, locations] = await Promise.all([
    salesOrders(from, to, location),
    salesOrders(previousFrom, previousTo, location),
    prisma.location.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ])

  const summarize = (list: { totalCents: number }[]) => {
    const revenueCents = list.reduce((sum, order) => sum + order.totalCents, 0)
    return { revenueCents, orders: list.length, averageCents: list.length ? Math.round(revenueCents / list.length) : 0 }
  }

  // Every day in the range, including days without sales
  const byDay = new Map<string, { date: string; revenueCents: number; orders: number }>()
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    byDay.set(date, { date, revenueCents: 0, orders: 0 })
  }
  const byLocation = new Map(locations.map((l) => [l.id, { id: l.id, name: l.name, revenueCents: 0, orders: 0 }]))
  const byProduct = new Map<number, { productId: number; name: string; quantity: number; revenueCents: number }>()

  for (const order of orders) {
    const day = byDay.get(shopToday(order.pickupAt))!
    day.revenueCents += order.totalCents
    day.orders += 1
    const shop = byLocation.get(order.locationId)!
    shop.revenueCents += order.totalCents
    shop.orders += 1
    for (const item of order.items) {
      // Named as on the order, i.e. the name it was sold under
      const product = byProduct.get(item.productId) ?? { productId: item.productId, name: item.name, quantity: 0, revenueCents: 0 }
      product.quantity += item.quantity
      product.revenueCents += item.unitPriceCents * item.quantity
      byProduct.set(item.productId, product)
    }
  }

  res.json({
    from,
    to,
    previous: { from: previousFrom, to: previousTo, ...summarize(previousOrders) },
    totals: summarize(orders),
    byDay: [...byDay.values()],
    byLocation: [...byLocation.values()].filter((l) => !location || l.id === location).sort((a, b) => b.revenueCents - a.revenueCents),
    topProducts: [...byProduct.values()].sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity).slice(0, TOP_PRODUCTS),
  })
})
