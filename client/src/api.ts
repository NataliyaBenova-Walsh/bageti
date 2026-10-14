// The API is always on the same address as the site: locally Vite passes /api to
// Express, and in production Vercel passes it to Render (see vercel.json). Being on
// the same site lets the admin login cookie work in every browser.

// An error response from the API, with its JSON body
export class ApiError extends Error {
  status: number
  body: { error?: string; soldOut?: number[]; fields?: Record<string, string[]> }

  constructor(status: number, body: ApiError['body']) {
    super(body.error ?? `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const getJson = <T>(path: string) => request<T>(path)

const sendJson = (method: string) => <T>(path: string, body?: unknown) =>
  request<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })

export const postJson = sendJson('POST')
export const patchJson = sendJson('PATCH')
