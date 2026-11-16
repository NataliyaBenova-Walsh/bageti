// Fills the last 90 days with made-up, already collected orders, so the sales dashboard has
// something to show. Their codes start with "DM-", and running this again replaces them.
// Remove them with: npm run db:seed-demo-orders -w server -- --remove
import { prisma } from '../src/db.js'
import { shopDayRange, shopToday } from '../src/pickup.js'

const DAYS = 90
const PREFIX = 'DM-'
const NAMES = ['Astrid', 'Erik', 'Maja', 'Lars', 'Elsa', 'Nils', 'Saga', 'Oskar', 'Ingrid', 'Hugo', 'Freja', 'Axel']

// A seeded random generator, so every run makes the same orders
let seed = 20261116
function random() {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32
  return seed / 2 ** 32
}
const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]

await prisma.order.deleteMany({ where: { code: { startsWith: PREFIX } } })
if (process.argv.includes('--remove')) {
  console.log('Removed the demo orders')
  process.exit(0)
}

const products = await prisma.product.findMany({ include: { category: true } })
const locations = await prisma.location.findMany({ orderBy: { sortOrder: 'asc' } })
if (products.length === 0 || locations.length === 0) throw new Error('Run the migrations and `npm run db:seed` first')

// Buns, cookies and bread sell most; whole cakes least
const weight = (categoryId: string) => ({ cakes: 1, breads: 3, 'sweet-treats': 4, 'savory-treats': 3 })[categoryId] ?? 2
const weighted = products.flatMap((p) => Array(weight(p.categoryId)).fill(p) as typeof products)
// The shops are busier in this order
const shopTraffic = [1, 0.75, 0.55]

const today = shopToday(new Date())
let count = 0
for (let back = DAYS; back >= 1; back--) {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - back)
  const date = d.toISOString().slice(0, 10)
  const weekend = [0, 6].includes(d.getUTCDay())
  // Slowly growing sales over the period
  const growth = 0.8 + (0.4 * (DAYS - back)) / DAYS
  const { start } = shopDayRange(date)

  for (const [index, location] of locations.entries()) {
    const orders = Math.round((weekend ? 9 : 5) * shopTraffic[index % shopTraffic.length] * growth * (0.6 + random() * 0.8))
    for (let n = 0; n < orders; n++) {
      const lines = new Map<number, { productId: number; name: string; unitPriceCents: number; quantity: number }>()
      const itemCount = 1 + Math.floor(random() * 3)
      for (let i = 0; i < itemCount; i++) {
        const product = pick(weighted)
        const line = lines.get(product.id) ?? { productId: product.id, name: product.name, unitPriceCents: product.priceCents, quantity: 0 }
        line.quantity += 1 + Math.floor(random() * 2)
        lines.set(product.id, line)
      }
      const items = [...lines.values()]
      // Opening hours 08:00–18:00: a 15-minute slot after 08:00 Swedish time
      const pickupAt = new Date(start.getTime() + (8 * 60 + Math.floor(random() * 40) * 15) * 60_000)
      const cancelled = random() < 0.04
      const name = pick(NAMES)
      await prisma.order.create({
        data: {
          code: `${PREFIX}${String(++count).padStart(5, '0')}`,
          customerName: `${name} (demo)`,
          email: `${name.toLowerCase()}@example.com`,
          phone: '+46 70 000 00 00',
          locationId: location.id,
          pickupAt,
          status: cancelled ? 'CANCELLED' : 'PICKED_UP',
          paymentStatus: random() < 0.4 ? 'PAID' : 'PAY_AT_PICKUP',
          totalCents: items.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
          items: { create: items },
          createdAt: new Date(pickupAt.getTime() - 3 * 60 * 60_000),
        },
      })
    }
  }
}
console.log(`Created ${count} demo orders over the last ${DAYS} days`)
