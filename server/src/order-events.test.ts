import type { AddressInfo } from 'node:net'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { app } from './app.js'
import { ensureAccounts } from './auth.js'
import { prisma } from './db.js'
import { shopToday } from './pickup.js'

// The live feed for the order board. It streams, so it's read from a real server with fetch
// rather than through supertest, which waits for the whole response.

const server = app.listen(0)
const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
const api = request(app)

beforeAll(async () => {
  await ensureAccounts()
})

afterAll(() => {
  server.closeAllConnections()
  server.close()
})

async function sessionCookie(email: string, password: string) {
  const res = await api.post('/api/auth/login').send({ email, password }).expect(200)
  return String(res.headers['set-cookie']).split(';')[0]
}

// Opens the feed and collects the "order" events it sends
async function openFeed(cookie: string) {
  const controller = new AbortController()
  const res = await fetch(`${baseUrl}/api/admin/orders/events`, { headers: { cookie }, signal: controller.signal })
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/event-stream')
  const events: unknown[] = []
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        buffer += value
        let end
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const message = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (message.startsWith('event: order\n')) events.push(JSON.parse(message.split('\ndata: ')[1]))
        }
      }
    } catch {
      // Closed by the test
    }
  })()
  return { events, close: () => controller.abort() }
}

async function placeOrder() {
  const slots = await api.get('/api/locations/riverside/pickup-slots').expect(200)
  const bun = await prisma.product.findFirstOrThrow({ where: { name: 'Cinnamon Bun' } })
  const res = await api
    .post('/api/orders')
    .send({
      customerName: 'Live Feed',
      email: 'live@example.com',
      phone: '+46 70 174 06 05',
      locationId: 'riverside',
      pickupAt: slots.body[0].slots[0],
      items: [{ productId: bun.id, quantity: 1 }],
    })
    .expect(201)
  return prisma.order.findUniqueOrThrow({ where: { code: res.body.code } })
}

describe('live order feed', () => {
  test('needs a staff or admin login', async () => {
    expect((await fetch(`${baseUrl}/api/admin/orders/events`)).status).toBe(401)
  })

  test('tells the board about new orders and status changes', async () => {
    const cookie = await sessionCookie('demo@test.example', 'demo-password')
    const feed = await openFeed(cookie)
    try {
      const order = await placeOrder()
      const expected = { orderId: order.id, date: shopToday(order.pickupAt), locationId: 'riverside' }
      await expect.poll(() => feed.events).toEqual([expected])

      await api.patch(`/api/admin/orders/${order.id}`).set('Cookie', cookie).send({ status: 'PREPARING' }).expect(200)
      await expect.poll(() => feed.events).toEqual([expected, expected])
    } finally {
      feed.close()
    }
  })
})
