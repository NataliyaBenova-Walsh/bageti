import Stripe from 'stripe'
import { prisma } from './db.js'
import { orderChanged } from './order-events.js'

// Card payments are only offered when a Stripe key is set (a test key, sk_test_…, for the demo)
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// How long the customer has to pay on Stripe (Stripe's minimum is 30 minutes).
// Pickups are at least an hour ahead, so a paid order still has time to be prepared.
const PAYMENT_WINDOW_MS = 35 * 60 * 1000

type OrderToPay = {
  id: number
  code: string
  email: string
  items: { name: string; unitPriceCents: number; quantity: number }[]
}

// A Stripe-hosted payment page for the order, with the prices the server worked out
export function createCheckoutSession(order: OrderToPay) {
  // Stripe sends the customer back to the shop after paying or cancelling
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  return stripe!.checkout.sessions.create({
    // Payment methods (cards, Klarna, …) are chosen in the Stripe Dashboard
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: order.code,
    metadata: { orderId: String(order.id), code: order.code },
    line_items: order.items.map((item) => ({
      quantity: item.quantity,
      price_data: { currency: 'sek', unit_amount: item.unitPriceCents, product_data: { name: item.name } },
    })),
    expires_at: Math.floor((Date.now() + PAYMENT_WINDOW_MS) / 1000),
    success_url: `${clientUrl}/order/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/checkout?payment=cancelled`,
  })
}

// Both only change orders still waiting for payment, so repeated or late webhooks do nothing
export async function markPaid(sessionId: string) {
  const result = await prisma.order.updateMany({
    where: { stripeSessionId: sessionId, paymentStatus: 'AWAITING_PAYMENT', status: 'NEW' },
    data: { paymentStatus: 'PAID' },
  })
  // Now paid, the order appears on the staff board
  if (result.count > 0) orderChanged(await prisma.order.findUniqueOrThrow({ where: { stripeSessionId: sessionId } }))
  return result
}

// Gives the customer their money back for a paid card order. The idempotency key makes
// Stripe ignore a second refund for the same order, e.g. if staff retry after an error.
export async function refundOrder(order: { id: number; stripeSessionId: string }) {
  const session = await stripe!.checkout.sessions.retrieve(order.stripeSessionId)
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntent) throw new Error(`Checkout session ${order.stripeSessionId} has no payment to refund`)
  return stripe!.refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `refund-order-${order.id}` })
}

export function cancelUnpaid(sessionId: string) {
  return prisma.order.updateMany({
    where: { stripeSessionId: sessionId, paymentStatus: 'AWAITING_PAYMENT', status: 'NEW' },
    data: { status: 'CANCELLED' },
  })
}
