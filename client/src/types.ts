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

// Pickup times for one Sofia date, as UTC ISO strings
export type PickupDay = { date: string; slots: string[] }

export type OrderConfirmation = {
  code: string
  customerName: string
  location: { name: string; address: string }
  pickupAt: string
  paymentStatus: 'PAY_AT_PICKUP' | 'PAID'
  totalCents: number
  items: { productId: number; name: string; unitPriceCents: number; quantity: number }[]
}
