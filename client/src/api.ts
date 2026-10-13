// Empty locally, where Vite's dev server passes /api to Express.
// In production it's the Render address, set as VITE_API_URL in Vercel.
const apiUrl = import.meta.env.VITE_API_URL ?? ''

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}
