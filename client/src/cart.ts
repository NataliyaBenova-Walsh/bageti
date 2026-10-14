import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartItem = { productId: number; name: string; priceCents: number; quantity: number }

export const MAX_QUANTITY = 20

type CartState = {
  items: CartItem[]
  add: (product: Omit<CartItem, 'quantity'>) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  clear: () => void
}

// Saved in localStorage, so the cart survives a page reload.
// Prices here are only for display: the server prices the order itself.
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product) =>
        set((state) => {
          const existing = state.items.find((item) => item.productId === product.productId)
          if (!existing) return { items: [...state.items, { ...product, quantity: 1 }] }
          return {
            items: state.items.map((item) =>
              item === existing ? { ...item, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) } : item,
            ),
          }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity < 1
              ? state.items.filter((item) => item.productId !== productId)
              : state.items.map((item) =>
                  item.productId === productId ? { ...item, quantity: Math.min(quantity, MAX_QUANTITY) } : item,
                ),
        })),
      remove: (productId) => set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'fika-cart' },
  ),
)

export const cartCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0)
export const cartTotal = (items: CartItem[]) => items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
