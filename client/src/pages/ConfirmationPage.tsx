import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { getJson } from '../api'
import { useCart } from '../cart'
import { formatPickup, formatPrice } from '../format'
import type { OrderConfirmation, PaymentStatus } from '../types'

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PAID: 'Paid',
  AWAITING_PAYMENT: 'Waiting for the payment to be confirmed',
  PAY_AT_PICKUP: 'Pay when you collect',
}

// After paying on Stripe, the customer comes back with the session id; fetch the order with it.
// Stripe can take a moment to confirm the payment, so ask again a few times while it's waiting.
function useOrderFromStripe(sessionId: string | null) {
  const clear = useCart((state) => state.clear)
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function load(attempt: number) {
      try {
        const found = await getJson<OrderConfirmation>(`/api/checkout-sessions/${encodeURIComponent(sessionId!)}`)
        if (stopped) return
        setOrder(found)
        clear()
        if (found.paymentStatus === 'AWAITING_PAYMENT' && attempt < 5) timer = setTimeout(() => load(attempt + 1), 2000)
      } catch {
        if (!stopped) setFailed(true)
      }
    }
    load(1)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [sessionId, clear])

  return { order, failed }
}

export function ConfirmationPage() {
  const sessionId = useSearchParams()[0].get('session_id')
  const fromStripe = useOrderFromStripe(sessionId)
  // Paying at pickup: the checkout passes the order along
  const placed = (useLocation().state as { order?: OrderConfirmation } | null)?.order
  const order = sessionId ? fromStripe.order : placed

  if (sessionId && !order && !fromStripe.failed) {
    return (
      <p role="status" className="text-center">
        Loading your order…
      </p>
    )
  }

  // Opened directly or after a reload: the order details were only in memory
  if (!order) {
    return (
      <div className="text-center">
        <h1 className="mb-4 font-hand text-4xl text-orange">No order to show</h1>
        <Link to="/" className="font-semibold text-orange underline">
          Back to the menu
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-center font-hand text-4xl text-orange">Thank you, {order.customerName}!</h1>
      <p className="mb-6 text-center">Your order is in. Show this code when you pick it up:</p>
      <p className="mb-8 text-center text-4xl font-bold tracking-widest text-med-brown">{order.code}</p>

      <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-semibold">Pickup</dt>
        <dd>{formatPickup(order.pickupAt)}</dd>
        <dt className="font-semibold">Shop</dt>
        <dd>
          {order.location.name}, {order.location.address}
        </dd>
        <dt className="font-semibold">Payment</dt>
        <dd>{PAYMENT_LABEL[order.paymentStatus]}</dd>
      </dl>

      <ul className="mb-2 space-y-1 border-t-2 border-beige pt-3">
        {order.items.map((item) => (
          <li key={item.productId} className="flex justify-between gap-4">
            <span>
              {item.quantity} × {item.name}
            </span>
            <span className="tabular-nums">{formatPrice(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t-2 border-beige pt-2 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatPrice(order.totalCents)}</span>
      </p>

      <p className="mt-8 text-center">
        <Link to="/" className="font-semibold text-orange underline">
          Back to the menu
        </Link>
      </p>
    </div>
  )
}
