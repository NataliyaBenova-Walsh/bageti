import { Link, Outlet, ScrollRestoration } from 'react-router'
import { cartCount, useCart } from '../cart'

export function Layout() {
  const count = useCart((state) => cartCount(state.items))

  return (
    <div className="min-h-screen bg-cream text-dark-brown">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-cream/95 px-4 py-3 shadow-sm sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="size-11" />
          <span className="font-hand text-2xl text-orange">Fika Bakery</span>
        </Link>
        <Link
          to="/checkout"
          className="rounded-full bg-orange px-4 py-2 font-semibold text-cream hover:bg-med-brown focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
        >
          Cart{count > 0 && <span aria-label={`, ${count} ${count === 1 ? 'item' : 'items'}`}> ({count})</span>}
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-beige/60 px-4 py-6 text-center text-sm text-taupe">
        Fika is a demo project, not a real shop. ·{' '}
        <Link to="/admin" className="underline">
          Staff login
        </Link>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
