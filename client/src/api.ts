// Empty locally, where Vite's dev server passes /api to Express.
// In production it's the Render address, set as VITE_API_URL in Vercel.
const apiUrl = import.meta.env.VITE_API_URL ?? ''

// An error response from the API, with its JSON body (e.g. { error, fields, soldOut })
export class ApiError extends Error {
  status: number
  body: { error?: string; soldOut?: number[] }

  constructor(status: number, body: ApiError['body']) {
    super(body.error ?? `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, init)
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json() as Promise<T>
}

export const getJson = <T>(path: string) => request<T>(path)

export const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
