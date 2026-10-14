import { app } from './app.js'
import { ensureAccounts } from './auth.js'

const port = Number(process.env.PORT ?? 3001)

await ensureAccounts()

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
