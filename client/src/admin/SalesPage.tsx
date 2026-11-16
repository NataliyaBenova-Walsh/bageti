import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { getJson } from '../api'
import { formatPrice, shopToday } from '../format'
import type { Location } from '../types'

type Totals = { revenueCents: number; orders: number; averageCents: number }
type Sales = {
  from: string
  to: string
  totals: Totals
  previous: Totals & { from: string; to: string }
  byDay: { date: string; revenueCents: number; orders: number }[]
  byLocation: { id: string; name: string; revenueCents: number; orders: number }[]
  topProducts: { productId: number; name: string; quantity: number; revenueCents: number }[]
}

const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]

// "2026-10-15" minus n days, by the calendar
function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatShortDate = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`))
const formatLongDate = (date: string) => longDate.format(new Date(`${date}T00:00:00Z`))
const kronor = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })

// Gridline steps on clean numbers (1, 2 or 5 × 10ⁿ kronor), about four of them
function axisTicks(maxCents: number): number[] {
  const max = Math.max(maxCents / 100, 1)
  const rough = max / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough)!
  const ticks = []
  for (let value = 0; value < max + step; value += step) ticks.push(value * 100)
  return ticks
}

// Change against the previous period: an arrow and words as well as colour
function Delta({ current, previous, days }: { current: number; previous: number; days: number }) {
  if (previous === 0) return <p className="text-sm text-taupe">No sales in the {days} days before</p>
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return <p className="text-sm text-taupe">Same as the {days} days before</p>
  const up = change > 0
  return (
    <p className="text-sm">
      <span className={`font-semibold ${up ? 'text-green' : 'text-red'}`}>
        <span aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? 'Up' : 'Down'} {Math.abs(change)}%
      </span>{' '}
      <span className="text-taupe">on the {days} days before</span>
    </p>
  )
}

function StatTile({ label, value, delta, hero }: { label: string; value: string; delta: ReactNode; hero?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-taupe">{label}</h2>
      <p className={`font-semibold ${hero ? 'text-5xl' : 'text-3xl'} my-1`}>{value}</p>
      {delta}
    </div>
  )
}

function TableView({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-orange underline">Show as a table</summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-beige text-left">
              {headers.map((h, i) => (
                <th key={h} scope="col" className={`py-1 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])} className="border-b border-beige/40">
                {row.map((cell, i) => (
                  <td key={i} className={`py-1 pr-3 ${i > 0 ? 'text-right' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

const PLOT_HEIGHT = 180

// Sales per day as columns. The pointer or the arrow keys pick a day, and its figures show
// in a tooltip; the highest day is labelled on the chart.
function DailyChart({ days }: { days: Sales['byDay'] }) {
  const [active, setActive] = useState<number | null>(null)
  const plot = useRef<HTMLDivElement>(null)
  const ticks = axisTicks(Math.max(...days.map((d) => d.revenueCents)))
  const top = ticks.at(-1)!
  const best = days.reduce((best, d, i) => (d.revenueCents > days[best].revenueCents ? i : best), 0)
  // About six date labels along the bottom, counted back from the last day so today is always labelled
  const labelEvery = Math.max(1, Math.ceil(days.length / 6))

  function pick(event: PointerEvent) {
    const rect = plot.current!.getBoundingClientRect()
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * days.length)
    setActive(Math.min(days.length - 1, Math.max(0, index)))
  }

  function keys(event: KeyboardEvent) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -days.length, End: days.length }
    if (!(event.key in moves)) return
    event.preventDefault()
    setActive((current) => Math.min(days.length - 1, Math.max(0, (current ?? days.length - 1) + moves[event.key])))
  }

  const shown = active === null ? null : days[active]
  return (
    <div className="flex gap-2">
      {/* Y axis: kronor, aligned with the gridlines */}
      <div className="relative w-14 shrink-0 text-right text-xs text-taupe tabular-nums" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / top) * 100}%` }}>
            {kronor.format(t / 100)} kr
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={plot}
          role="img"
          tabIndex={0}
          aria-label={`Sales per day from ${formatLongDate(days[0].date)} to ${formatLongDate(days.at(-1)!.date)}. Highest: ${formatPrice(days[best].revenueCents)} on ${formatLongDate(days[best].date)}. Use the arrow keys to read each day, or the table below.`}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((current) => current ?? days.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={keys}
          className="relative focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
          style={{ height: PLOT_HEIGHT }}
        >
          {/* Gridlines: solid hairlines, one step off the surface */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-beige/35" style={{ top: `${100 - (t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {days.map((d, i) => (
              <div key={d.date} className="flex h-full flex-1 items-end justify-center px-px">
                {d.revenueCents > 0 && (
                  <div
                    className={`relative w-full max-w-6 rounded-t ${i === active ? 'bg-med-brown' : 'bg-orange'}`}
                    style={{ height: `${(d.revenueCents / top) * 100}%` }}
                  >
                    {i === best && active === null && (
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-semibold whitespace-nowrap">
                        {formatPrice(d.revenueCents)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {shown && (
            <div
              className="pointer-events-none absolute -top-2 z-10 rounded-md bg-dark-brown px-3 py-2 text-sm whitespace-nowrap text-cream shadow"
              style={{
                left: `${((active! + 0.5) / days.length) * 100}%`,
                transform: `translate(${active! < days.length / 2 ? '-10%' : '-90%'}, -100%)`,
              }}
            >
              <div className="text-base font-semibold">{formatPrice(shown.revenueCents)}</div>
              <div>
                {formatLongDate(shown.date)} · {shown.orders} {shown.orders === 1 ? 'order' : 'orders'}
              </div>
            </div>
          )}
        </div>
        {/* X axis: dates */}
        <div className="relative mt-1 h-5 text-xs text-taupe" aria-hidden="true">
          {days.map((d, i) => {
            const fromEnd = days.length - 1 - i
            if (fromEnd % labelEvery !== 0) return null
            // On narrow screens, only every other label fits
            const narrowHidden = (fromEnd / labelEvery) % 2 === 1 ? 'hidden sm:block' : ''
            // The last label ends at the chart's edge rather than hanging over it
            const position = fromEnd === 0 && days.length > 7 ? { right: 0 } : { left: `${((i + 0.5) / days.length) * 100}%` }
            return (
              <span
                key={d.date}
                className={`absolute whitespace-nowrap ${fromEnd === 0 && days.length > 7 ? '' : '-translate-x-1/2'} ${narrowHidden}`}
                style={position}
              >
                {formatShortDate(d.date)}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Ranked horizontal bars, largest first, one colour; each value is printed at its bar's tip.
// Where the card is narrow, the name goes on its own line above the bar.
function RankedBars({ rows, label }: { rows: { key: string | number; name: string; value: number; detail: string }[]; label: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="grid items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
          <span className="truncate font-semibold" title={row.name}>
            {row.name}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {/* The bar leaves room for its value, the longest being about 10rem */}
            {row.value > 0 && <span className="h-4 shrink-0 rounded-r bg-orange" style={{ width: `calc((100% - 10.5rem) * ${row.value / max})` }} />}
            <span className="whitespace-nowrap tabular-nums">
              {formatPrice(row.value)} <span className="text-taupe">· {row.detail}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function SalesPage() {
  const [range, setRange] = useState<Range>(30)
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [sales, setSales] = useState<Sales | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getJson<Location[]>('/api/locations').then(setLocations).catch(() => {})
  }, [])

  useEffect(() => {
    // The last N days up to and including today, in Swedish time
    const to = shopToday()
    const params = new URLSearchParams({ from: daysBefore(to, range - 1), to })
    if (locationId) params.set('location', locationId)
    let stale = false
    // Keep showing the previous figures, faded, while the new ones load
    const start = setTimeout(() => setLoading(true), 0)
    getJson<Sales>(`/api/admin/sales?${params}`)
      .then((result) => {
        if (stale) return
        setSales(result)
        setError(null)
      })
      .catch(() => !stale && setError("The sales figures couldn't be loaded."))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
      clearTimeout(start)
    }
  }, [range, locationId])

  const hasSales = (sales?.totals.orders ?? 0) > 0

  return (
    <>
      <h1 className="mb-1 font-hand text-4xl text-orange">Sales</h1>
      <p className="mb-4 text-sm text-taupe">
        By pickup day, in Swedish time. Cancelled orders and unpaid card orders don't count.
      </p>

      {/* One row of filters, above everything they apply to */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Period" className="flex gap-2">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={range === days}
              onClick={() => setRange(days)}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                range === days ? 'border-orange bg-orange text-cream' : 'border-beige bg-white hover:border-orange'
              }`}
            >
              Last {days} days
            </button>
          ))}
        </div>
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

      {error && (
        <p role="alert" className="mb-4 font-semibold text-med-brown">
          {error}
        </p>
      )}
      {!sales && !error && <p role="status">Loading the sales figures…</p>}

      {sales && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div className="grid gap-4 md:grid-cols-3">
            <StatTile
              hero
              label="Sales"
              value={formatPrice(sales.totals.revenueCents)}
              delta={<Delta current={sales.totals.revenueCents} previous={sales.previous.revenueCents} days={range} />}
            />
            <StatTile
              label="Orders"
              value={String(sales.totals.orders)}
              delta={<Delta current={sales.totals.orders} previous={sales.previous.orders} days={range} />}
            />
            <StatTile
              label="Average order"
              value={hasSales ? formatPrice(sales.totals.averageCents) : '–'}
              delta={
                hasSales && sales.previous.orders > 0 ? (
                  <Delta current={sales.totals.averageCents} previous={sales.previous.averageCents} days={range} />
                ) : (
                  <p className="text-sm text-taupe">&nbsp;</p>
                )
              }
            />
          </div>

          {!hasSales ? (
            <p className="rounded-lg bg-white p-6 text-center shadow-sm">No sales in this period.</p>
          ) : (
            <>
              <section aria-labelledby="daily-title" className="rounded-lg bg-white p-4 shadow-sm">
                <h2 id="daily-title" className="mb-8 text-lg font-semibold">
                  Sales per day
                </h2>
                <DailyChart days={sales.byDay} />
                <TableView
                  caption="Sales per day"
                  headers={['Day', 'Orders', 'Sales']}
                  rows={sales.byDay.map((d) => [formatLongDate(d.date), d.orders, formatPrice(d.revenueCents)])}
                />
              </section>

              <div className="grid items-start gap-6 lg:grid-cols-2">
                <section aria-labelledby="shops-title" className="rounded-lg bg-white p-4 shadow-sm">
                  <h2 id="shops-title" className="mb-4 text-lg font-semibold">
                    Sales by shop
                  </h2>
                  <RankedBars
                    label="Sales by shop"
                    rows={sales.byLocation.map((l) => ({
                      key: l.id,
                      name: l.name,
                      value: l.revenueCents,
                      detail: `${l.orders} ${l.orders === 1 ? 'order' : 'orders'}`,
                    }))}
                  />
                </section>
                <section aria-labelledby="products-title" className="rounded-lg bg-white p-4 shadow-sm">
                  <h2 id="products-title" className="mb-4 text-lg font-semibold">
                    Best-selling products
                  </h2>
                  <RankedBars
                    label="Best-selling products"
                    rows={sales.topProducts.map((p) => ({
                      key: p.productId,
                      name: p.name,
                      value: p.revenueCents,
                      detail: `${p.quantity} sold`,
                    }))}
                  />
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
