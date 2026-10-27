import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import { STAFF_LOGIN } from './e2e/accounts'

config({ path: 'server/.env', quiet: true })

// End-to-end tests: a real browser against the client and API, on their own ports
// and the test database, so a running `npm run dev` isn't disturbed.
const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl) throw new Error('Set TEST_DATABASE_URL in server/.env (see server/.env.example)')

const API_PORT = 3101
const CLIENT_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx server/src/index.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: testDatabaseUrl,
        JWT_SECRET: 'e2e-secret',
        ADMIN_EMAIL: 'admin@test.example',
        ADMIN_PASSWORD: 'admin-password',
        DEMO_EMAIL: STAFF_LOGIN.email,
        DEMO_PASSWORD: STAFF_LOGIN.password,
        // Pay at pickup only, as in CI, even if server/.env has a Stripe key
        STRIPE_SECRET_KEY: '',
      },
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -w client -- --port ${CLIENT_PORT} --strictPort`,
      url: `http://localhost:${CLIENT_PORT}`,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
  ],
})
