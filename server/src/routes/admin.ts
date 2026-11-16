import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../auth.js'
import { cloudinary, isProductImageUrl, signProductUpload } from '../cloudinary.js'
import { onOrderChange, orderChanged } from '../order-events.js'
import { prisma } from '../db.js'
import type { OrderStatus, Prisma } from '../generated/prisma/client.js'
import { shopDayRange, shopToday } from '../pickup.js'
import { refundOrder, stripe } from '../stripe.js'

export const adminRouter = Router()

// Staff (including the public demo login) can work with orders and mark products
// sold out; adding products and changing their details needs an admin.
const staffOrAdmin = requireRole('STAFF', 'ADMIN')
const adminOnly = requireRole('ADMIN')

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
adminRouter.get('/admin/orders', staffOrAdmin, async (req, res) => {
  const parsed = orderQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid filter' })
    return
  }
  const { date = shopToday(new Date()), status, location } = parsed.data
  const { start, end } = shopDayRange(date)
  const orders = await prisma.order.findMany({
    // Card orders only reach the board once they're paid
    where: { pickupAt: { gte: start, lt: end }, status, locationId: location, paymentStatus: { not: 'AWAITING_PAYMENT' } },
    orderBy: [{ pickupAt: 'asc' }, { id: 'asc' }],
    include: {
      location: { select: { id: true, name: true } },
      items: { select: { productId: true, name: true, unitPriceCents: true, quantity: true } },
    },
  })
  res.json(orders)
})

// A live feed for the order board (server-sent events): an "order" event whenever an order on
// the board is placed, paid or changes status. The data says which order, day and shop, so a board
// showing another day can ignore it. Browsers reconnect by themselves if the connection drops.
const HEARTBEAT_MS = 25 * 1000
// Ending the stream now and then makes the browser reconnect, which checks the login again
const STREAM_MAX_MS = 60 * 60 * 1000

adminRouter.get('/admin/orders/events', staffOrAdmin, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Asks proxies not to hold events back
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write('retry: 5000\n\n')

  const stop = onOrderChange((change) => res.write(`event: order\ndata: ${JSON.stringify(change)}\n\n`))
  // A comment line now and then, so proxies don't close a quiet connection
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
  const maxAge = setTimeout(() => res.end(), STREAM_MAX_MS)
  req.on('close', () => {
    stop()
    clearInterval(heartbeat)
    clearTimeout(maxAge)
  })
})

adminRouter.patch('/admin/orders/:id', staffOrAdmin, async (req, res) => {
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

  // Cancelling an order paid by card gives the money back. The order is claimed as cancelled first,
  // so two staff screens can't both refund it; if Stripe fails, it goes back to its earlier step.
  if (next === 'CANCELLED' && order.paymentStatus === 'PAID' && order.stripeSessionId) {
    try {
      if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set')
      await refundOrder({ id, stripeSessionId: order.stripeSessionId })
    } catch (error) {
      console.error(error)
      await prisma.order.updateMany({ where: { id, status: 'CANCELLED' }, data: { status: order.status } })
      res.status(502).json({ error: "The card payment couldn't be refunded, so the order wasn't cancelled. Please try again." })
      return
    }
    await prisma.order.update({ where: { id }, data: { paymentStatus: 'REFUNDED' } })
    orderChanged(order)
    res.json({ id, status: next, paymentStatus: 'REFUNDED' })
    return
  }
  orderChanged(order)
  res.json({ id, status: next, paymentStatus: order.paymentStatus })
})

const productInput = z.object({
  name: z.string().trim().min(2, 'Please enter a name').max(80),
  description: z.string().trim().max(200),
  priceCents: z.number().int().min(1, 'Price must be more than 0').max(100000),
  categoryId: z.string().min(1, 'Please choose a category'),
  available: z.boolean(),
  // A photo uploaded with the signature from /admin/uploads/product-image, or null for none
  imageUrl: z
    .string()
    .max(500)
    .refine(isProductImageUrl, 'Please upload the photo from the products page')
    .nullable()
    .optional(),
})

function validationError(error: z.ZodError) {
  return { error: 'Please check the product details', fields: z.flattenError(error).fieldErrors }
}

adminRouter.post('/admin/products', adminOnly, async (req, res) => {
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
adminRouter.patch('/admin/products/:id', staffOrAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const parsed = productInput.partial().safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json(parsed.success ? { error: 'Invalid product id' } : validationError(parsed.error))
    return
  }
  const changesDetails = Object.keys(parsed.data).some((key) => key !== 'available')
  if (changesDetails && res.locals.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only admins can change product details' })
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

// Permission for the browser to upload one product photo straight to Cloudinary. Admins only,
// like the other product details, so the public demo login can't upload.
adminRouter.post('/admin/uploads/product-image', adminOnly, (_req, res) => {
  if (!cloudinary) {
    res.status(503).json({ error: 'Photo uploads are not set up' })
    return
  }
  res.json(signProductUpload())
})
