// Entry point on Vercel: the same Express app as server.ts, exported as a request handler
// instead of listening on a port. Vercel routes every /api/* request here, keeping the
// original URL, so the app's routes work unchanged. The pool lives as long as the function
// instance; DATABASE_URL should be Neon's pooled connection string.
import { createApp } from './app.ts'
import { loadServerConfig } from './config.ts'
import { createPool } from './db/pool.ts'

const config = loadServerConfig()
const pool = createPool(config.DATABASE_URL)

export default createApp({
  pool,
  corsOrigin: config.CORS_ORIGIN,
  auth: { jwtSecret: config.JWT_SECRET, secureCookies: config.NODE_ENV === 'production' },
  cronSecret: config.CRON_SECRET,
})
