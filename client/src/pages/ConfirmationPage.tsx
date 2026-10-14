import { Link, useLocation } from 'react-router'
import { formatPickup, formatPrice } from '../format'
import type { OrderConfirmation } from '../types'

export function ConfirmationPage() {
  const order = (useLocation().state as { order?: OrderConfirmation } | null)?.order

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
        <dd>{order.paymentStatus === 'PAID' ? 'Paid' : 'Pay when you collect'}</dd>
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
