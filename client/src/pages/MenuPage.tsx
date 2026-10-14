import { useEffect, useState } from 'react'
import { getJson } from '../api'
import { useCart } from '../cart'
import { formatPrice } from '../format'
import type { Category } from '../types'

export function MenuPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState(false)
  const [slow, setSlow] = useState(false)
  const cartItems = useCart((state) => state.items)
  const add = useCart((state) => state.add)

  useEffect(() => {
    // The free Render server sleeps when idle and takes up to a minute to wake
    const slowTimer = setTimeout(() => setSlow(true), 3000)
    getJson<Category[]>('/api/categories')
      .then(setCategories)
      .catch(() => setError(true))
      .finally(() => clearTimeout(slowTimer))
    return () => clearTimeout(slowTimer)
  }, [])

  return (
    <>
      <h1 className="mb-2 text-center font-hand text-4xl text-orange">Our Menu</h1>
      <p className="mb-8 text-center">Order ahead and pick up at any of our shops. You pay when you collect.</p>

      {error && <p className="text-center">The menu couldn't be loaded. Please try again later.</p>}
      {!error && !categories && (
        <p className="text-center" role="status">
          {slow ? 'Waking up the server, this can take up to a minute…' : 'Loading the menu…'}
        </p>
      )}

      {categories && (
        <div className="grid gap-10 md:grid-cols-2">
          {categories.map((category) => (
            <section key={category.id} aria-labelledby={`category-${category.id}`}>
              <h2 id={`category-${category.id}`} className="mb-4 border-b-2 border-beige pb-1 text-2xl font-semibold text-med-brown">
                {category.name}
              </h2>
              <ul className="space-y-4">
                {category.products.map((product) => {
                  const inCart = cartItems.find((item) => item.productId === product.id)?.quantity ?? 0
                  return (
                    <li key={product.id} className="flex items-start justify-between gap-4">
                      <div className={product.available ? undefined : 'opacity-60'}>
                        <div className="font-semibold">{product.name}</div>
                        <p className="text-sm text-taupe">{product.description}</p>
                        <div className="text-sm tabular-nums">{formatPrice(product.priceCents)}</div>
                      </div>
                      {product.available ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => add({ productId: product.id, name: product.name, priceCents: product.priceCents })}
                            aria-label={`Add ${product.name} to cart`}
                            className="rounded-full border-2 border-orange px-3 py-1 text-sm font-semibold text-orange hover:bg-orange hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                          >
                            Add
                          </button>
                          <span className="text-xs text-taupe" aria-live="polite">
                            {inCart > 0 && `${inCart} in cart`}
                          </span>
                        </div>
                      ) : (
                        <span className="shrink-0 text-sm font-semibold">Sold out</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
