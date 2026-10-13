import { useEffect, useState } from 'react'

type Product = {
  id: number
  name: string
  description: string
  priceCents: number
  available: boolean
  categoryId: string
}

type Category = { id: string; name: string; products: Product[] }

const price = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

function App() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Category[]>
      })
      .then(setCategories)
      .catch(() => setError(true))
  }, [])

  return (
    <div className="min-h-screen bg-cream text-dark-brown">
      <header className="flex items-center gap-3 px-4 py-4 sm:px-8">
        <img src="/logo.svg" alt="" className="size-12" />
        <span className="font-hand text-2xl text-orange">Fika Bakery</span>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
        <h1 className="mb-8 text-center font-hand text-4xl text-orange">Our Menu</h1>

        {error && <p className="text-center">The menu couldn't be loaded. Please try again later.</p>}
        {!error && !categories && <p className="text-center">Loading the menu…</p>}

        {categories && (
          <div className="grid gap-10 md:grid-cols-2">
            {categories.map((category) => (
              <section key={category.id} aria-labelledby={`category-${category.id}`}>
                <h2 id={`category-${category.id}`} className="mb-4 border-b-2 border-beige pb-1 text-2xl font-semibold text-med-brown">
                  {category.name}
                </h2>
                <ul className="space-y-3">
                  {category.products.map((product) => (
                    <li key={product.id} className={product.available ? undefined : 'opacity-60'}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-semibold">{product.name}</span>
                        <span className="shrink-0 tabular-nums">
                          {product.available ? price.format(product.priceCents / 100) : 'Sold out'}
                        </span>
                      </div>
                      <p className="text-sm text-taupe">{product.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
