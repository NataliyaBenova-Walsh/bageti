import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, getJson, patchJson, postJson } from '../api'
import { formatPrice } from '../format'
import type { Category, Product } from '../types'

type Draft = { name: string; description: string; price: string; categoryId: string }

const emptyDraft = (categoryId = ''): Draft => ({ name: '', description: '', price: '', categoryId })

const inputClass = 'w-full rounded-md border-2 border-beige bg-white px-2 py-1 focus:border-orange focus:outline-none'

// "45" or "45,50" or "45.50" kronor → öre
function parsePrice(price: string): number | null {
  const kronor = Number(price.trim().replace(',', '.'))
  return Number.isFinite(kronor) && kronor > 0 ? Math.round(kronor * 100) : null
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const firstFieldError = Object.values(err.body.fields ?? {}).flat()[0]
    return firstFieldError ?? err.body.error ?? 'Something went wrong.'
  }
  return 'Something went wrong. Please try again.'
}

function ProductForm({
  draft,
  categories,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
}: {
  draft: Draft
  categories: Category[]
  onChange: (draft: Draft) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
  busy: boolean
}) {
  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[2fr_3fr_1fr_1.5fr_auto] sm:items-end">
      <label className="text-sm font-semibold">
        Name
        <input required value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className={inputClass} />
      </label>
      <label className="text-sm font-semibold">
        Description
        <input
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className="text-sm font-semibold">
        Price (kr)
        <input
          required
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => onChange({ ...draft, price: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className="text-sm font-semibold">
        Category
        <select
          required
          value={draft.categoryId}
          onChange={(e) => onChange({ ...draft, categoryId: e.target.value })}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-orange px-4 py-1.5 font-semibold text-cream hover:bg-med-brown disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm underline">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export function ProductsPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft())
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const load = async () => setCategories(await getJson<Category[]>('/api/categories'))

  useEffect(() => {
    getJson<Category[]>('/api/categories')
      .then(setCategories)
      .catch(() => setMessage({ text: "Products couldn't be loaded.", error: true }))
  }, [])

  async function save(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      await load()
      setMessage({ text: success, error: false })
      return true
    } catch (err) {
      setMessage({ text: errorMessage(err), error: true })
      return false
    } finally {
      setBusy(false)
    }
  }

  function draftToBody(draft: Draft) {
    return { name: draft.name, description: draft.description, priceCents: parsePrice(draft.price) ?? 0, categoryId: draft.categoryId }
  }

  const toggleAvailable = (product: Product) =>
    save(
      () => patchJson(`/api/admin/products/${product.id}`, { available: !product.available }),
      `${product.name} is now ${product.available ? 'sold out' : 'back in stock'}.`,
    )

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditDraft({
      name: product.name,
      description: product.description,
      price: String(product.priceCents / 100),
      categoryId: product.categoryId,
    })
  }

  async function saveEdit(id: number) {
    if (await save(() => patchJson(`/api/admin/products/${id}`, draftToBody(editDraft)), 'Product saved.')) setEditingId(null)
  }

  async function addProduct() {
    const body = { ...draftToBody(newDraft), available: true }
    if (await save(() => postJson('/api/admin/products', body), `${newDraft.name} added to the menu.`)) {
      setNewDraft(emptyDraft(newDraft.categoryId))
    }
  }

  if (!categories) return <p role="status">{message?.text ?? 'Loading products…'}</p>

  return (
    <>
      <h1 className="mb-1 font-hand text-4xl text-orange">Products</h1>
      <p className="mb-6 text-sm text-taupe">Sold-out products stay on the menu but can't be ordered.</p>

      <div aria-live="polite">
        {message && (
          <p className={`mb-4 font-semibold ${message.error ? 'text-med-brown' : 'text-green'}`} role={message.error ? 'alert' : undefined}>
            {message.text}
          </p>
        )}
      </div>

      <section aria-labelledby="add-title" className="mb-8 rounded-lg bg-white p-4 shadow-sm">
        <h2 id="add-title" className="mb-2 text-lg font-semibold">
          Add a product
        </h2>
        <ProductForm draft={newDraft} categories={categories} onChange={setNewDraft} onSubmit={addProduct} submitLabel="Add" busy={busy} />
      </section>

      {categories.map((category) => (
        <section key={category.id} aria-labelledby={`admin-category-${category.id}`} className="mb-8">
          <h2 id={`admin-category-${category.id}`} className="mb-2 border-b-2 border-beige pb-1 text-xl font-semibold text-med-brown">
            {category.name}
          </h2>
          <ul className="divide-y divide-beige/60">
            {category.products.map((product) =>
              editingId === product.id ? (
                <li key={product.id} className="py-3">
                  <ProductForm
                    draft={editDraft}
                    categories={categories}
                    onChange={setEditDraft}
                    onSubmit={() => saveEdit(product.id)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save"
                    busy={busy}
                  />
                </li>
              ) : (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className={product.available ? undefined : 'opacity-60'}>
                    <span className="font-semibold">{product.name}</span>
                    <span className="ml-2 tabular-nums">{formatPrice(product.priceCents)}</span>
                    <div className="text-sm text-taupe">{product.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleAvailable(product)}
                      aria-label={`${product.name}: ${product.available ? 'in stock, mark as sold out' : 'sold out, mark as in stock'}`}
                      className={`rounded-full px-3 py-1 text-sm font-semibold disabled:opacity-60 ${
                        product.available ? 'bg-green text-cream' : 'border-2 border-med-brown text-med-brown'
                      }`}
                    >
                      {product.available ? 'In stock' : 'Sold out'}
                    </button>
                    <button type="button" onClick={() => startEdit(product)} className="text-sm text-orange underline">
                      Edit
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </>
  )
}
