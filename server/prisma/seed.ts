// Loads data/menu.json into the database. Safe to run more than once:
// categories and products are matched by id and name, then updated or created.
import { readFile } from 'node:fs/promises'
import { prisma } from '../src/db.js'

type MenuFile = {
  categories: {
    id: string
    name: string
    items: { name: string; description: string; priceCents: number }[]
  }[]
}

const menuPath = new URL('../../data/menu.json', import.meta.url)
const menu = JSON.parse(await readFile(menuPath, 'utf8')) as MenuFile

await prisma.$transaction(async (tx) => {
  for (const [categoryIndex, category] of menu.categories.entries()) {
    await tx.category.upsert({
      where: { id: category.id },
      update: { name: category.name, sortOrder: categoryIndex },
      create: { id: category.id, name: category.name, sortOrder: categoryIndex },
    })

    for (const [itemIndex, item] of category.items.entries()) {
      const data = {
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        sortOrder: itemIndex,
        categoryId: category.id,
      }
      const existing = await tx.product.findFirst({ where: { name: item.name } })
      if (existing) {
        await tx.product.update({ where: { id: existing.id }, data })
      } else {
        await tx.product.create({ data })
      }
    }
  }
})

const productCount = await prisma.product.count()
console.log(`Seeded ${menu.categories.length} categories, ${productCount} products`)
await prisma.$disconnect()
