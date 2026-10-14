import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError, postJson } from '../api'

const inputClass = 'w-full rounded-md border-2 border-beige bg-white px-3 py-2 focus:border-orange focus:outline-none'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const next = useSearchParams()[0].get('next')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await postJson('/api/auth/login', { email, password })
      // Only follow links back into the admin area
      navigate(next?.startsWith('/admin') ? next : '/admin', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.body.error ? err.body.error : "Couldn't log in. Please try again.")
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 text-dark-brown">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <div className="text-center">
          <img src="/logo.svg" alt="" className="mx-auto size-16" />
          <h1 className="font-hand text-3xl text-orange">Staff login</h1>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block font-semibold">
            Email
          </label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="font-semibold text-med-brown">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-orange px-6 py-2 font-semibold text-cream hover:bg-med-brown disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-center text-sm">
          <Link to="/" className="text-orange underline">
            Back to the shop
          </Link>
        </p>
      </form>
    </div>
  )
}
