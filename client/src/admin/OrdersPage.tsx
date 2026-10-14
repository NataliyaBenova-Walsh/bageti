import { useCallback, useEffect, useState } from 'react'
import { ApiError, getJson, patchJson } from '../api'
import { formatDate, formatPrice, formatTime, shopToday } from '../format'
import type { AdminOrder, Location, OrderStatus } from '../types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'New',
  PREPARING: 'Preparing',
  READY: 'Ready',
  PICKED_UP: 'Picked up',
  CANCELLED: 'Cancelled',
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  NEW: 'bg-orange text-cream',
  PREPARING: 'bg-beige text-dark-brown',
  READY: 'bg-green text-cream',
  PICKED_UP: 'bg-cream text-taupe border border-beige',
  CANCELLED: 'bg-cream text-taupe border border-beige line-through',
}

// The button that moves an order to its next step (the server enforces the same order)
const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  NEW: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'READY', label: 'Mark ready' },
  READY: { status: 'PICKED_UP', label: 'Picked up' },
}

const FILTERS: (OrderStatus | 'ALL')[] = ['ALL', 'NEW', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED']

const REFRESH_SECONDS = 30

export function OrdersPage() {
  const [date, setDate] = useState(shopToday)
  const [locationId, setLocationId] = useState('')
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [locations, setLocations] = useState<Location[]>([])
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ date })
    if (locationId) params.set('location', locationId)
    try {
      setOrders(await getJson<AdminOrder[]>(`/api/admin/orders?${params}`))
      setError(null)
    } catch {
      setError("Orders couldn't be loaded. Retrying…")
    }
  }, [date, locationId])

  useEffect(() => {
    getJson<Location[]>('/api/locations').then(setLocations).catch(() => {})
  }, [])

  // Reload when the filters change, and every 30 seconds to pick up new orders
  useEffect(() => {
    const first = setTimeout(load, 0)
    const timer = setInterval(load, REFRESH_SECONDS * 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [load])

  async function changeStatus(order: AdminOrder, status: OrderStatus) {
    if (status === 'CANCELLED' && !window.confirm(`Cancel order ${order.code} for ${order.customerName}?`)) return
    setBusyId(order.id)
    try {
      await patchJson(`/api/admin/orders/${order.id}`, { status })
      setOrders((current) => current?.map((o) => (o.id === order.id ? { ...o, status } : o)) ?? null)
    } catch (err) {
      setError(err instanceof ApiError && err.body.error ? err.body.error : "The order couldn't be updated.")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const counts = Object.fromEntries(FILTERS.map((f) => [f, orders?.filter((o) => f === 'ALL' || o.status === f).length ?? 0]))
  const shown = orders?.filter((order) => filter === 'ALL' || order.status === filter) ?? []

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-hand text-4xl text-orange">Orders</h1>
          <p className="text-sm text-taupe">Pickups on {formatDate(`${date}T12:00:00Z`)}. Updates every 30 seconds.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-semibold">
            Day
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="ml-2 rounded-md border-2 border-beige bg-white px-2 py-1 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Shop
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="ml-2 rounded-md border-2 border-beige bg-white px-2 py-1 font-normal"
            >
              <option value="">All shops</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div role="group" aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
              filter === f ? 'border-orange bg-orange text-cream' : 'border-beige bg-white hover:border-orange'
            }`}
          >
            {f === 'ALL' ? 'All' : STATUS_LABEL[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 font-semibold text-med-brown">
          {error}
        </p>
      )}
      {!orders && !error && <p role="status">Loading orders…</p>}
      {orders && shown.length === 0 && <p>No orders here.</p>}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((order) => {
          const next = NEXT_STEP[order.status]
          const busy = busyId === order.id
          return (
            <li key={order.id} className="flex flex-col rounded-lg bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold tabular-nums">{formatTime(order.pickupAt)}</div>
                  <div className="text-sm text-taupe">{order.location.name}</div>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${STATUS_STYLE[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                  <div className="mt-1 font-mono text-sm font-semibold">{order.code}</div>
                </div>
              </div>

              <div className="mb-2">
                <div className="font-semibold">{order.customerName}</div>
                <div className="text-sm">
                  <a href={`tel:${order.phone.replace(/[^+\d]/g, '')}`} className="underline">
                    {order.phone}
                  </a>
                  {' · '}
                  <a href={`mailto:${order.email}`} className="underline">
                    {order.email}
                  </a>
                </div>
              </div>

              <ul className="mb-2 border-t border-beige pt-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.productId} className="flex justify-between gap-2">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span className="tabular-nums">{formatPrice(item.unitPriceCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-3 flex justify-between border-t border-beige pt-1 text-sm font-semibold">
                <span>{order.paymentStatus === 'PAID' ? 'Paid' : 'Pay at pickup'}</span>
                <span className="tabular-nums">{formatPrice(order.totalCents)}</span>
              </div>
              {order.note && <p className="mb-3 rounded bg-cream p-2 text-sm italic">“{order.note}”</p>}

              {next && (
                <div className="mt-auto flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeStatus(order, next.status)}
                    className="rounded-full bg-orange px-4 py-2 font-semibold text-cream hover:bg-med-brown disabled:opacity-60"
                  >
                    {next.label}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeStatus(order, 'CANCELLED')}
                    className="text-sm text-med-brown underline disabled:opacity-60"
                  >
                    Cancel order
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
