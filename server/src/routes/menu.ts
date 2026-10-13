import { Router } from 'express'
import { prisma } from '../db.js'

export const menuRouter = Router()

const productFields = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  available: true,
  categoryId: true,
} as const

// The whole menu: categories in display order, each with its products
menuRouter.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      products: { orderBy: { sortOrder: 'asc' }, select: productFields },
    },
  })
  res.json(categories)
})

// All products, or one category's with ?category=<id>
menuRouter.get('/products', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined
  const products = await prisma.product.findMany({
    where: { categoryId: category },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: productFields,
  })
  res.json(products)
})

menuRouter.get('/products/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Product id must be a number' })
    return
  }
  const product = await prisma.product.findUnique({ where: { id }, select: productFields })
  if (!product) {
    res.status(404).json({ error: 'Product not found' })
    return
  }
  res.json(product)
})
