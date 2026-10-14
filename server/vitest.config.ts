import 'dotenv/config'
import { defineConfig } from 'vitest/config'

// Tests run against their own database, which they empty and refill (see test/global-setup.ts)
const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('Set TEST_DATABASE_URL (see .env.example) before running the tests')
if (testUrl === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must not be the same as DATABASE_URL')
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(testUrl)) throw new Error('TEST_DATABASE_URL must be a local database')

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: './test/global-setup.ts',
    // The API tests share one database, so run test files one at a time
    fileParallelism: false,
    env: {
      DATABASE_URL: testUrl,
      JWT_SECRET: 'test-secret',
      ADMIN_EMAIL: 'admin@test.example',
      ADMIN_PASSWORD: 'admin-password',
      DEMO_EMAIL: 'demo@test.example',
      DEMO_PASSWORD: 'demo-password',
    },
  },
})
