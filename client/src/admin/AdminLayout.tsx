import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { getJson, postJson } from '../api'
import type { User } from '../types'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 font-semibold ${isActive ? 'bg-orange text-cream' : 'text-orange hover:bg-beige/30'}`

// Wraps every admin page: checks the login first and sends visitors without one to the login page
export function AdminLayout() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getJson<User>('/api/auth/me')
      .then((me) => {
        if (me.role !== 'ADMIN' && me.role !== 'STAFF') throw new Error('Not staff')
        setUser(me)
      })
      .catch(() => navigate(`/admin/login?next=${encodeURIComponent(location.pathname)}`, { replace: true }))
  }, [navigate, location.pathname])

  async function logOut() {
    await postJson('/api/auth/logout').catch(() => {})
    navigate('/admin/login', { replace: true })
  }

  if (!user) return <p className="p-8 text-center" role="status">Checking your login…</p>

  return (
    <div className="min-h-screen bg-cream text-dark-brown">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm sm:px-8">
        <Link to="/admin" className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="size-10" />
          <span className="font-hand text-2xl text-orange">Fika Admin</span>
        </Link>
        <nav aria-label="Admin" className="flex flex-wrap items-center gap-1">
          <NavLink to="/admin" end className={navClass}>
            Orders
          </NavLink>
          <NavLink to="/admin/products" className={navClass}>
            Products
          </NavLink>
          <span className="px-2 text-sm text-taupe">{user.name}</span>
          <button type="button" onClick={logOut} className="px-3 py-2 text-sm text-med-brown underline">
            Log out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-8">
        <Outlet context={user} />
      </main>
    </div>
  )
}
