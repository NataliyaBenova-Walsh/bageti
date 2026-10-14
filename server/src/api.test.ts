import request from 'supertest'
import { beforeAll, describe, expect, test } from 'vitest'
import { app } from './app.js'
import { ensureAccounts } from './auth.js'
import { prisma } from './db.js'

// These run against the test database, filled from data/menu.json by test/global-setup.ts

const api = request(app)

async function firstPickupSlot(locationId = 'old-town'): Promise<string> {
  const res = await api.get(`/api/locations/${locationId}/pickup-slots`).expect(200)
  return res.body[0].slots[0]
}

async function productId(name: string): Promise<number> {
  return (await prisma.product.findFirstOrThrow({ where: { name } })).id
}

// Places an order (2 cinnamon buns at the first slot, unless overridden) and checks the status code
async function placeOrder(overrides: Record<string, unknown> = {}, expectedStatus = 201) {
  const order = {
    customerName: 'Test Customer',
    email: 'customer@example.com',
    phone: '+46 70 174 06 05',
    locationId: 'old-town',
    pickupAt: await firstPickupSlot(),
    items: [{ productId: await productId('Cinnamon Bun'), quantity: 2 }],
    ...overrides,
  }
  return api.post('/api/orders').send(order).expect(expectedStatus)
}

// A logged-in session that keeps its cookie between requests
async function logIn(email: string, password: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email, password }).expect(200)
  return agent
}

beforeAll(async () => {
  await ensureAccounts()
})

describe('menu and shops', () => {
  test('health check reaches the database', async () => {
    const res = await api.get('/api/health').expect(200)
    expect(res.body).toEqual({ status: 'ok', database: 'ok' })
  })

  test('categories list the menu in order, with prices in öre', async () => {
    const res = await api.get('/api/categories').expect(200)
    expect(res.body.map((c: { id: string }) => c.id)).toEqual(['cakes', 'sweet-treats', 'savory-treats', 'breads'])
    const bun = res.body[1].products.find((p: { name: string }) => p.name === 'Cinnamon Bun')
    expect(bun).toMatchObject({ priceCents: 3800, available: true })
  })

  test('products can be filtered by category, and unknown ids give 404', async () => {
    const breads = await api.get('/api/products?category=breads').expect(200)
    expect(breads.body).toHaveLength(8)
    await api.get('/api/products/999999').expect(404)
    await api.get('/api/products/abc').expect(400)
  })

  test('there are three shops with pickup slots', async () => {
    const res = await api.get('/api/locations').expect(200)
    expect(res.body.map((l: { name: string }) => l.name)).toEqual(['Fika Stockholm', 'Fika Gothenburg', 'Fika Malmö'])
    const slots = await api.get('/api/locations/garden/pickup-slots').expect(200)
    expect(slots.body.length).toBeGreaterThan(0)
    await api.get('/api/locations/nowhere/pickup-slots').expect(404)
  })
})

describe('placing orders', () => {
  test('a valid order is saved and priced by the server', async () => {
    const bunId = await productId('Cinnamon Bun')
    const res = await placeOrder({
      // The client can't set prices: unitPriceCents here is ignored
      items: [
        { productId: bunId, quantity: 2, unitPriceCents: 1 },
        { productId: bunId, quantity: 1 },
      ],
    })
    expect(res.body.code).toMatch(/^FK-[2-9A-HJ-NP-Z]{4}$/)
    expect(res.body.items).toEqual([{ productId: bunId, name: 'Cinnamon Bun', unitPriceCents: 3800, quantity: 3 }])
    expect(res.body.totalCents).toBe(11400)
    expect(res.body.paymentStatus).toBe('PAY_AT_PICKUP')
  })

  test('invalid details are refused with a message per field', async () => {
    const res = await placeOrder({ customerName: 'A', email: 'not-an-email', phone: 'x', items: [] }, 400)
    expect(Object.keys(res.body.fields).sort()).toEqual(['customerName', 'email', 'items', 'phone'])
  })

  test('pickup times outside the slots are refused', async () => {
    const slot = new Date(await firstPickupSlot())
    const offSlot = new Date(slot.getTime() + 5 * 60 * 1000).toISOString()
    await placeOrder({ pickupAt: offSlot }, 400)
  })

  test('sold-out products are refused with their ids', async () => {
    const id = await productId('Brownie')
    await prisma.product.update({ where: { id }, data: { available: false } })
    try {
      const res = await placeOrder({ items: [{ productId: id, quantity: 1 }] }, 409)
      expect(res.body.soldOut).toEqual([id])
    } finally {
      await prisma.product.update({ where: { id }, data: { available: true } })
    }
  })

  test('unknown products and shops are refused', async () => {
    await placeOrder({ items: [{ productId: 999999, quantity: 1 }] }, 400)
    await placeOrder({ locationId: 'nowhere' }, 400)
  })

  test('broken JSON gets a JSON error', async () => {
    const res = await api.post('/api/orders').set('Content-Type', 'application/json').send('{bad').expect(400)
    expect(res.body.error).toMatch(/not valid JSON/)
  })
})

describe('logging in', () => {
  test('wrong email and wrong password get the same answer', async () => {
    const wrongEmail = await api.post('/api/auth/login').send({ email: 'nobody@test.example', password: 'x' }).expect(401)
    const wrongPassword = await api.post('/api/auth/login').send({ email: 'admin@test.example', password: 'x' }).expect(401)
    expect(wrongEmail.body).toEqual(wrongPassword.body)
  })

  test('login sets an httpOnly cookie, and logout ends the session', async () => {
    const agent = request.agent(app)
    const res = await agent.post('/api/auth/login').send({ email: 'ADMIN@test.example', password: 'admin-password' }).expect(200)
    expect(res.headers['set-cookie'][0]).toMatch(/fika_session=.+HttpOnly/)
    expect((await agent.get('/api/auth/me').expect(200)).body).toMatchObject({ email: 'admin@test.example', role: 'ADMIN' })
    await agent.post('/api/auth/logout').expect(204)
    await agent.get('/api/auth/me').expect(401)
  })

  test('a forged cookie is rejected', async () => {
    await api.get('/api/auth/me').set('Cookie', 'fika_session=not.a.jwt').expect(401)
  })
})

describe('admin and staff permissions', () => {
  test('admin routes need a login', async () => {
    await api.get('/api/admin/orders').expect(401)
    await api.patch('/api/admin/products/1').send({ available: false }).expect(401)
  })

  test('orders move one step at a time and can be cancelled until picked up', async () => {
    const admin = await logIn('admin@test.example', 'admin-password')
    const placed = await placeOrder()
    const { id } = await prisma.order.findUniqueOrThrow({ where: { code: placed.body.code } })

    await admin.patch(`/api/admin/orders/${id}`).send({ status: 'READY' }).expect(409)
    for (const status of ['PREPARING', 'READY', 'PICKED_UP']) {
      await admin.patch(`/api/admin/orders/${id}`).send({ status }).expect(200)
    }
    await admin.patch(`/api/admin/orders/${id}`).send({ status: 'CANCELLED' }).expect(409)
  })

  test("the order list shows one day's orders", async () => {
    const admin = await logIn('admin@test.example', 'admin-password')
    const placed = await placeOrder()
    const date = placed.body.pickupAt.slice(0, 10)
    // pickupAt is UTC; an 08:00 Swedish pickup is still the same calendar date in UTC
    const res = await admin.get(`/api/admin/orders?date=${date}`).expect(200)
    expect(res.body.map((o: { code: string }) => o.code)).toContain(placed.body.code)
    await admin.get('/api/admin/orders?date=yesterday').expect(400)
  })

  test('staff can work with orders and mark products sold out, but not change the menu', async () => {
    const staff = await logIn('demo@test.example', 'demo-password')
    const id = await productId('Croissant')
    const placed = await placeOrder()
    const order = await prisma.order.findUniqueOrThrow({ where: { code: placed.body.code } })

    await staff.patch(`/api/admin/orders/${order.id}`).send({ status: 'PREPARING' }).expect(200)
    await staff.patch(`/api/admin/products/${id}`).send({ available: false }).expect(200)
    await staff.patch(`/api/admin/products/${id}`).send({ available: true }).expect(200)
    await staff.patch(`/api/admin/products/${id}`).send({ priceCents: 100 }).expect(403)
    await staff
      .post('/api/admin/products')
      .send({ name: 'Free Cake', description: '', priceCents: 100, categoryId: 'cakes', available: true })
      .expect(403)
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).priceCents).toBe(3200)
  })

  test('admins can add and edit products', async () => {
    const admin = await logIn('admin@test.example', 'admin-password')
    const created = await admin
      .post('/api/admin/products')
      .send({ name: 'Cardamom Bun', description: 'With crushed cardamom', priceCents: 3800, categoryId: 'sweet-treats', available: true })
      .expect(201)
    const edited = await admin.patch(`/api/admin/products/${created.body.id}`).send({ priceCents: 3900 }).expect(200)
    expect(edited.body.priceCents).toBe(3900)
    await admin.patch(`/api/admin/products/${created.body.id}`).send({ priceCents: 0 }).expect(400)
    await admin.patch(`/api/admin/products/${created.body.id}`).send({ categoryId: 'nowhere' }).expect(400)
  })
})
