import request from 'supertest'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { app } from './app.js'
import { ensureAccounts } from './auth.js'
import { prisma } from './db.js'
import { stripe } from './stripe.js'

// Card payments, without calling Stripe: its API calls are replaced, and webhooks are
// signed here with the test secret from vitest.config.ts

const api = request(app)
const WEBHOOK_SECRET = 'whsec_test_secret'

let sessionCount = 0
const createSession = vi.spyOn(stripe!.checkout.sessions, 'create')
const retrieveSession = vi.spyOn(stripe!.checkout.sessions, 'retrieve')

beforeAll(async () => {
  await ensureAccounts()
})

afterEach(() => {
  createSession.mockReset()
  retrieveSession.mockReset()
})

// Places a card order for 2 cinnamon buns and returns the response and the Stripe session id
async function placeCardOrder() {
  const sessionId = `cs_test_${++sessionCount}`
  createSession.mockResolvedValue({ id: sessionId, url: `https://checkout.stripe.test/${sessionId}` } as never)
  const slots = await api.get('/api/locations/old-town/pickup-slots').expect(200)
  const bun = await prisma.product.findFirstOrThrow({ where: { name: 'Cinnamon Bun' } })
  const res = await api
    .post('/api/orders')
    .send({
      customerName: 'Card Customer',
      email: 'card@example.com',
      phone: '+46 70 174 06 05',
      locationId: 'old-town',
      pickupAt: slots.body[0].slots[0],
      items: [{ productId: bun.id, quantity: 2 }],
      payment: 'card',
    })
    .expect(201)
  return { res, sessionId }
}

function sendWebhook(type: string, session: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: 'evt_test', object: 'event', type, data: { object: { object: 'checkout.session', ...session } } })
  const signature = stripe!.webhooks.generateTestHeaderString({ payload, secret })
  return api.post('/api/stripe/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', signature).send(payload)
}

async function orderFor(sessionId: string) {
  return prisma.order.findUniqueOrThrow({ where: { stripeSessionId: sessionId } })
}

async function boardCodes(date: string) {
  const admin = request.agent(app)
  await admin.post('/api/auth/login').send({ email: 'admin@test.example', password: 'admin-password' }).expect(200)
  const res = await admin.get(`/api/admin/orders?date=${date}`).expect(200)
  return res.body.map((order: { code: string }) => order.code)
}

describe('card payments', () => {
  test('the checkout can offer card payments', async () => {
    expect((await api.get('/api/payment-options').expect(200)).body).toEqual({ card: true })
  })

  test('a card order opens a Stripe payment page with the server prices, and waits for payment', async () => {
    const { res, sessionId } = await placeCardOrder()
    expect(res.body.checkoutUrl).toBe(`https://checkout.stripe.test/${sessionId}`)
    expect(res.body.paymentStatus).toBe('AWAITING_PAYMENT')

    const params = createSession.mock.calls[0][0]!
    expect(params).toMatchObject({
      mode: 'payment',
      customer_email: 'card@example.com',
      client_reference_id: res.body.code,
      success_url: 'http://shop.test/order/confirmation?session_id={CHECKOUT_SESSION_ID}',
      line_items: [{ quantity: 2, price_data: { currency: 'sek', unit_amount: 3800, product_data: { name: 'Cinnamon Bun' } } }],
    })
    // Staff don't see it until it's paid
    expect(await boardCodes(res.body.pickupAt.slice(0, 10))).not.toContain(res.body.code)
  })

  test('the webhook marks the order paid, and staff then see it', async () => {
    const { res, sessionId } = await placeCardOrder()
    await sendWebhook('checkout.session.completed', { id: sessionId, payment_status: 'paid' }).expect(200)
    expect((await orderFor(sessionId)).paymentStatus).toBe('PAID')
    // Stripe can send the same event again
    await sendWebhook('checkout.session.completed', { id: sessionId, payment_status: 'paid' }).expect(200)
    expect(await boardCodes(res.body.pickupAt.slice(0, 10))).toContain(res.body.code)
  })

  test('a bank payment that has not cleared yet is not marked paid', async () => {
    const { sessionId } = await placeCardOrder()
    await sendWebhook('checkout.session.completed', { id: sessionId, payment_status: 'unpaid' }).expect(200)
    expect((await orderFor(sessionId)).paymentStatus).toBe('AWAITING_PAYMENT')
  })

  test('an expired payment page cancels the order', async () => {
    const { sessionId } = await placeCardOrder()
    await sendWebhook('checkout.session.expired', { id: sessionId, payment_status: 'unpaid' }).expect(200)
    expect(await orderFor(sessionId)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'AWAITING_PAYMENT' })
  })

  test('webhooks with a wrong signature are refused', async () => {
    const { sessionId } = await placeCardOrder()
    await sendWebhook('checkout.session.completed', { id: sessionId, payment_status: 'paid' }, 'whsec_wrong').expect(400)
    await api.post('/api/stripe/webhook').set('Content-Type', 'application/json').send('{}').expect(400)
    expect((await orderFor(sessionId)).paymentStatus).toBe('AWAITING_PAYMENT')
  })

  test('back from Stripe, the customer sees the order, paid even if the webhook is late', async () => {
    const { res, sessionId } = await placeCardOrder()
    retrieveSession.mockResolvedValue({ id: sessionId, payment_status: 'paid' } as never)
    const confirmation = await api.get(`/api/checkout-sessions/${sessionId}`).expect(200)
    expect(confirmation.body).toMatchObject({ code: res.body.code, paymentStatus: 'PAID', totalCents: 7600 })
    await api.get('/api/checkout-sessions/cs_test_unknown').expect(404)
  })

  test('if Stripe fails, no order is left behind', async () => {
    createSession.mockRejectedValue(new Error('Stripe is down'))
    const before = await prisma.order.count()
    const slots = await api.get('/api/locations/old-town/pickup-slots').expect(200)
    const bun = await prisma.product.findFirstOrThrow({ where: { name: 'Cinnamon Bun' } })
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    await api
      .post('/api/orders')
      .send({
        customerName: 'Card Customer',
        email: 'card@example.com',
        phone: '+46 70 174 06 05',
        locationId: 'old-town',
        pickupAt: slots.body[0].slots[0],
        items: [{ productId: bun.id, quantity: 1 }],
        payment: 'card',
      })
      .expect(502)
    expect(await prisma.order.count()).toBe(before)
  })
})
