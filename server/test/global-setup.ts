import { execSync } from 'node:child_process'

// Before the tests: bring the test database up to date, empty it, and load the menu
export default function setup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }
  const run = (command: string, input?: string) => execSync(command, { env, input, stdio: ['pipe', 'ignore', 'inherit'] })

  run('npx prisma migrate deploy')
  run(
    'npx prisma db execute --stdin',
    'TRUNCATE "OrderItem", "Order", "Product", "Category", "User" RESTART IDENTITY CASCADE;',
  )
  run('npx tsx prisma/seed.ts')
}
