import request from 'supertest'
import { beforeAll, describe, expect, test } from 'vitest'
import { app } from './app.js'
import { ensureAccounts } from './auth.js'
import { prisma } from './db.js'

// Sales figures, from orders written straight into the database in 2020, a range no other test uses

const api = request(app)

async function logIn(email: string, password: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email, password }).expect(200)
  return agent
}

let code = 0
async function order(pickupAt: string, locationId: string, items: { name: string; price: number; quantity: number }[], extra = {}) {
  const products = await prisma.product.findMany({ where: { name: { in: items.map((i) => i.name) } } })
  const lines = items.map((item) => ({
    productId: products.find((p) => p.name === item.name)!.id,
    name: item.name,
    unitPriceCents: item.price,
    quantity: item.quantity,
  }))
  await prisma.order.create({
    data: {
      code: `TS-${++code}`,
      customerName: 'Sales Test',
      email: 'sales@example.com',
      phone: '+46 70 000 00 00',
      locationId,
      pickupAt: new Date(pickupAt),
      totalCents: lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
      items: { create: lines },
      ...extra,
    },
  })
}

beforeAll(async () => {
  await ensureAccounts()
  await prisma.order.deleteMany({ where: { code: { startsWith: 'TS-' } } })
  // March 2–8, 2020, Swedish time (UTC+1 in winter)
  await order('2020-03-02T09:00:00Z', 'old-town', [{ name: 'Cinnamon Bun', price: 3800, quantity: 2 }]) // 76 kr
  await order('2020-03-02T23:30:00Z', 'riverside', [{ name: 'Croissant', price: 3200, quantity: 1 }]) // 00:30 on March 3 in Sweden
  await order('2020-03-05T10:00:00Z', 'riverside', [
    { name: 'Cinnamon Bun', price: 3800, quantity: 1 },
    { name: 'Croissant', price: 3200, quantity: 3 },
  ]) // 134 kr
  // Not sales: cancelled, and a card order nobody paid
  await order('2020-03-04T10:00:00Z', 'old-town', [{ name: 'Croissant', price: 3200, quantity: 5 }], { status: 'CANCELLED' })
  await order('2020-03-04T11:00:00Z', 'old-town', [{ name: 'Croissant', price: 3200, quantity: 5 }], { paymentStatus: 'AWAITING_PAYMENT' })
  // The week before, for the comparison
  await order('2020-02-26T10:00:00Z', 'garden', [{ name: 'Croissant', price: 3200, quantity: 2 }]) // 64 kr
})

describe('sales figures', () => {
  test('need a staff or admin login', async () => {
    await api.get('/api/admin/sales?from=2020-03-02&to=2020-03-08').expect(401)
  })

  test('add up a week by Swedish pickup day, shop and product, against the week before', async () => {
    const staff = await logIn('demo@test.example', 'demo-password')
    const { body } = await staff.get('/api/admin/sales?from=2020-03-02&to=2020-03-08').expect(200)

    expect(body.totals).toEqual({ revenueCents: 7600 + 3200 + 13400, orders: 3, averageCents: 8067 })
    expect(body.previous).toEqual({ from: '2020-02-24', to: '2020-03-01', revenueCents: 6400, orders: 1, averageCents: 6400 })

    expect(body.byDay).toHaveLength(7)
    expect(body.byDay.slice(0, 4)).toEqual([
      { date: '2020-03-02', revenueCents: 7600, orders: 1 },
      { date: '2020-03-03', revenueCents: 3200, orders: 1 },
      { date: '2020-03-04', revenueCents: 0, orders: 0 },
      { date: '2020-03-05', revenueCents: 13400, orders: 1 },
    ])

    expect(body.byLocation.map((l: { id: string; revenueCents: number }) => [l.id, l.revenueCents])).toEqual([
      ['riverside', 16600],
      ['old-town', 7600],
      ['garden', 0],
    ])
    expect(body.topProducts).toEqual([
      expect.objectContaining({ name: 'Croissant', quantity: 4, revenueCents: 12800 }),
      expect.objectContaining({ name: 'Cinnamon Bun', quantity: 3, revenueCents: 11400 }),
    ])
  })

  test('can be limited to one shop', async () => {
    const staff = await logIn('demo@test.example', 'demo-password')
    const { body } = await staff.get('/api/admin/sales?from=2020-03-02&to=2020-03-08&location=old-town').expect(200)
    expect(body.totals.revenueCents).toBe(7600)
    expect(body.byLocation).toEqual([{ id: 'old-town', name: expect.any(String), revenueCents: 7600, orders: 1 }])
  })

  test('refuse a missing, reversed or too long range', async () => {
    const staff = await logIn('demo@test.example', 'demo-password')
    await staff.get('/api/admin/sales').expect(400)
    await staff.get('/api/admin/sales?from=2020-03-08&to=2020-03-02').expect(400)
    await staff.get('/api/admin/sales?from=2020-01-01&to=2021-06-01').expect(400)
  })
})
