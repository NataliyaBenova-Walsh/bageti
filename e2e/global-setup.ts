import { execSync } from 'node:child_process'

// Make sure the test database has the tables and the menu (both steps are safe to repeat)
export default function setup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }
  const run = (command: string) => execSync(command, { cwd: 'server', env, stdio: ['ignore', 'ignore', 'inherit'] })
  run('npx prisma migrate deploy')
  run('npx tsx prisma/seed.ts')
}
