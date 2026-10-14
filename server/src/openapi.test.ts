import { readdirSync, readFileSync } from 'node:fs'
import request from 'supertest'
import { expect, test } from 'vitest'
import { app, openapi } from './app.js'

// Every route in the code, as "METHOD /api/path/{param}", read from the route definitions
function routesInCode(): string[] {
  const files = ['app.ts', ...readdirSync(new URL('./routes', import.meta.url)).map((file) => `routes/${file}`)]
  return files.flatMap((file) => {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
    return [...source.matchAll(/\.(get|post|patch|put|delete)\('(\/[^']*)'/g)].map(([, method, path]) => {
      const fullPath = path.startsWith('/api') ? path : `/api${path}`
      return `${method.toUpperCase()} ${fullPath.replace(/:(\w+)/g, '{$1}')}`
    })
  })
}

function routesInDocs(): string[] {
  return Object.entries(openapi.paths as Record<string, Record<string, unknown>>).flatMap(([path, methods]) =>
    Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
  )
}

test('every API route is documented, and every documented route exists', () => {
  const inCode = routesInCode().filter((route) => route !== 'GET /api/openapi.json')
  expect(inCode.length).toBeGreaterThan(10)
  expect(routesInDocs().sort()).toEqual(inCode.sort())
})

test('the docs are served', async () => {
  const json = await request(app).get('/api/openapi.json').expect(200)
  expect(json.body.info.title).toBe('Fika Bakery API')
  const page = await request(app).get('/api/docs/').expect(200)
  expect(page.text).toContain('Fika Bakery API')
})
