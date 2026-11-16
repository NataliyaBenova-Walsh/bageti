import { EventEmitter } from 'node:events'
import { shopToday } from './pickup.js'

// Tells open staff order boards that an order changed, so they reload at once instead of
// waiting for their next refresh. This lives in the server's memory, which is enough for one
// server (as on Render). Several servers would need a shared channel, such as Postgres LISTEN/NOTIFY.

// What a board needs to decide whether to reload: the order, and its Swedish pickup date and shop
export type OrderChange = { orderId: number; date: string; locationId: string }

const emitter = new EventEmitter()
// One listener per open board, so don't warn when there are many
emitter.setMaxListeners(0)

export function orderChanged(order: { id: number; pickupAt: Date; locationId: string }) {
  const change: OrderChange = { orderId: order.id, date: shopToday(order.pickupAt), locationId: order.locationId }
  emitter.emit('change', change)
}

export function onOrderChange(listener: (change: OrderChange) => void): () => void {
  emitter.on('change', listener)
  return () => emitter.off('change', listener)
}
