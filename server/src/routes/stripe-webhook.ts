import type { RequestHandler } from 'express'
import type Stripe from 'stripe'
import { cancelUnpaid, markPaid, stripe } from '../stripe.js'

// Stripe tells the server about payments here. The body must be the raw bytes Stripe signed,
// so this is mounted with express.raw() before the JSON parser (see app.ts).
export const stripeWebhook: RequestHandler = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    res.status(503).json({ error: 'Card payments are not set up' })
    return
  }
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, req.header('stripe-signature') ?? '', secret)
  } catch {
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      // "completed" can also mean a bank payment that hasn't cleared yet; then async_payment_succeeded follows
      if (event.data.object.payment_status === 'paid') await markPaid(event.data.object.id)
      break
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      // The customer never paid: cancel the order, which staff never saw
      await cancelUnpaid(event.data.object.id)
      break
  }
  res.json({ received: true })
}
