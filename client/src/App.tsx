import { useEffect, useState } from 'react'

type Health = { status: string; database: string }

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setError(true))
  }, [])

  return (
    <main className="min-h-screen bg-cream text-dark-brown flex flex-col items-center justify-center gap-4 p-4">
      <img src="/logo.svg" alt="" className="size-28" />
      <h1 className="font-hand text-3xl text-orange">Fika Bakery</h1>
      <p>Online ordering is on its way.</p>
      <p className="text-sm">
        API:{' '}
        {error ? 'server not reachable' : health ? `${health.status}, database ${health.database}` : 'checking…'}
      </p>
    </main>
  )
}

export default App
