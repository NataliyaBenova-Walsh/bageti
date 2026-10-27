// Shapes of the API's JSON responses

export type Product = {
  id: number
  name: string
  description: string
  priceCents: number
  available: boolean
  categoryId: string
}

export type Category = { id: string; name: string; products: Product[] }

export type Location = { id: string; name: string; address: string; opensAt: string; closesAt: string }

// Pickup times for one Swedish date, as UTC ISO strings
export type PickupDay = { date: string; slots: string[] }

// AWAITING_PAYMENT: a card order whose payment on Stripe isn't finished
export type PaymentStatus = 'PAY_AT_PICKUP' | 'AWAITING_PAYMENT' | 'PAID'

export type OrderConfirmation = {
  code: string
  customerName: string
  location: { name: string; address: string }
  pickupAt: string
  paymentStatus: PaymentStatus
  totalCents: number
  items: { productId: number; name: string; unitPriceCents: number; quantity: number }[]
  // Card orders: Stripe's payment page
  checkoutUrl?: string
}

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'CANCELLED'

export type User = { id: number; email: string; name: string; role: 'CUSTOMER' | 'STAFF' | 'ADMIN' }

export type AdminOrder = {
  id: number
  code: string
  customerName: string
  email: string
  phone: string
  note: string | null
  pickupAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  totalCents: number
  createdAt: string
  location: { id: string; name: string }
  items: { productId: number; name: string; unitPriceCents: number; quantity: number }[]
}
