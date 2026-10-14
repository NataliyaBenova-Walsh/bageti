import { Router } from 'express'
import { z } from 'zod'
import { requireAdmin } from '../auth.js'
import { prisma } from '../db.js'
import type { OrderStatus, Prisma } from '../generated/prisma/client.js'
import { shopDayRange, shopToday } from '../pickup.js'

export const adminRouter = Router()
adminRouter.use('/admin', requireAdmin)

const STATUSES = ['NEW', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'] as const

// Orders move forward one step at a time, and can be cancelled until they're picked up
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: [],
  CANCELLED: [],
}

const orderQuery = z.object({
  // A Swedish date, "YYYY-MM-DD". Defaults to today.
  date: z.iso.date().optional(),
  status: z.enum(STATUSES).optional(),
  location: z.string().optional(),
})

// Orders for one pickup day, earliest pickup first
adminRouter.get('/admin/orders', async (req, res) => {
  const parsed = orderQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid filter' })
    return
  }
  const { date = shopToday(new Date()), status, location } = parsed.data
  const { start, end } = shopDayRange(date)
  const orders = await prisma.order.findMany({
    where: { pickupAt: { gte: start, lt: end }, status, locationId: location },
    orderBy: [{ pickupAt: 'asc' }, { id: 'asc' }],
    include: {
      location: { select: { id: true, name: true } },
      items: { select: { productId: true, name: true, unitPriceCents: true, quantity: true } },
    },
  })
  res.json(orders)
})

adminRouter.patch('/admin/orders/:id', async (req, res) => {
  const id = Number(req.params.id)
  const parsed = z.object({ status: z.enum(STATUSES) }).safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid order or status' })
    return
  }
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  const next = parsed.data.status
  if (!NEXT_STATUSES[order.status].includes(next)) {
    res.status(409).json({ error: `An order that is ${order.status} can't become ${next}` })
    return
  }
  // Only update if the status hasn't changed meanwhile (e.g. on another staff screen)
  const { count } = await prisma.order.updateMany({ where: { id, status: order.status }, data: { status: next } })
  if (count === 0) {
    res.status(409).json({ error: 'This order was just changed by someone else. Please refresh.' })
    return
  }
  res.json({ id, status: next })
})

const productInput = z.object({
  name: z.string().trim().min(2, 'Please enter a name').max(80),
  description: z.string().trim().max(200),
  priceCents: z.number().int().min(1, 'Price must be more than 0').max(100000),
  categoryId: z.string().min(1, 'Please choose a category'),
  available: z.boolean(),
})

function validationError(error: z.ZodError) {
  return { error: 'Please check the product details', fields: z.flattenError(error).fieldErrors }
}

adminRouter.post('/admin/products', async (req, res) => {
  const parsed = productInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error))
    return
  }
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } })
  if (!category) {
    res.status(400).json({ error: 'Unknown category' })
    return
  }
  // New products go at the end of their category
  const last = await prisma.product.aggregate({ where: { categoryId: category.id }, _max: { sortOrder: true } })
  const product = await prisma.product.create({
    data: { ...parsed.data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  })
  res.status(201).json(product)
})

// Any subset of the fields, e.g. { "available": false } to mark a product sold out
adminRouter.patch('/admin/products/:id', async (req, res) => {
  const id = Number(req.params.id)
  const parsed = productInput.partial().safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json(parsed.success ? { error: 'Invalid product id' } : validationError(parsed.error))
    return
  }
  const data: Prisma.ProductUncheckedUpdateInput = parsed.data
  if (parsed.data.categoryId && !(await prisma.category.findUnique({ where: { id: parsed.data.categoryId } }))) {
    res.status(400).json({ error: 'Unknown category' })
    return
  }
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Product not found' })
    return
  }
  const product = await prisma.product.update({ where: { id }, data })
  res.json(product)
})
