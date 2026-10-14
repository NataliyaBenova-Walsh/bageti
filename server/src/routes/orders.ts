import { randomInt } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/client.js'
import { isPickupAllowed } from '../pickup.js'

export const ordersRouter = Router()

const orderInput = z.object({
  customerName: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.email('Please enter a valid email address').max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Please enter a valid phone number'),
  note: z.string().trim().max(500).optional(),
  locationId: z.string().min(1, 'Please choose a shop'),
  pickupAt: z.iso.datetime('Please choose a pickup time'),
  items: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) }))
    .min(1, 'Your cart is empty')
    .max(50),
})

// Unambiguous characters only (no 0/O, 1/I/L), so codes are easy to read out at the counter
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function orderCode(): string {
  return 'FK-' + Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
}

// A public form that writes to the database: slow down anyone sending lots of orders
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many orders. Please try again later.' },
  // Off in automated tests, which send many requests from one address
  skip: () => process.env.NODE_ENV === 'test',
})

ordersRouter.post('/orders', orderLimiter, async (req, res) => {
  const parsed = orderInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Please check the order details', fields: z.flattenError(parsed.error).fieldErrors })
    return
  }
  const input = parsed.data
  const pickupAt = new Date(input.pickupAt)

  const location = await prisma.location.findUnique({ where: { id: input.locationId } })
  if (!location) {
    res.status(400).json({ error: 'Please choose a shop' })
    return
  }
  if (!isPickupAllowed(location, pickupAt, new Date())) {
    res.status(400).json({ error: 'That pickup time is no longer available. Please choose another.' })
    return
  }

  // Merge repeated products, then price everything from the database, never from the client
  const quantities = new Map<number, number>()
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
  const products = await prisma.product.findMany({ where: { id: { in: [...quantities.keys()] } } })
  if (products.length !== quantities.size) {
    res.status(400).json({ error: 'Some items are no longer on the menu. Please check your cart.' })
    return
  }
  const soldOut = products.filter((product) => !product.available)
  if (soldOut.length > 0) {
    res.status(409).json({
      error: `Sorry, ${soldOut.map((product) => product.name).join(', ')} sold out. Please remove it from your cart.`,
      soldOut: soldOut.map((product) => product.id),
    })
    return
  }

  const items = products.map((product) => ({
    productId: product.id,
    name: product.name,
    unitPriceCents: product.priceCents,
    quantity: quantities.get(product.id)!,
  }))
  const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)

  // Codes are random, so retry in the rare case one is already taken
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await prisma.order.create({
        data: {
          code: orderCode(),
          customerName: input.customerName,
          email: input.email,
          phone: input.phone,
          note: input.note || null,
          locationId: location.id,
          pickupAt,
          totalCents,
          items: { create: items },
        },
        include: { items: true },
      })
      res.status(201).json({
        code: order.code,
        customerName: order.customerName,
        location: { name: location.name, address: location.address },
        pickupAt: order.pickupAt,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        items: order.items.map(({ productId, name, unitPriceCents, quantity }) => ({ productId, name, unitPriceCents, quantity })),
      })
      return
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }
  throw new Error('Could not create a unique order code')
})
