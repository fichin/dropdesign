// Restores the demo board and demo account in the database from DATABASE_URL.
// Usage: npm run demo:reset   (WIPES every board, task, comment and person first)
import { loadDatabaseUrl } from '../config.ts'
import { createPool, withTransaction } from '../db/pool.ts'
import { DEMO_EMAIL } from './account.ts'
import { resetDemo } from './board.ts'

const pool = createPool(loadDatabaseUrl())
try {
  const boardId = await withTransaction(pool, (client) => resetDemo(client))
  console.log(`Demo board restored (${boardId}); demo account: ${DEMO_EMAIL}`)
} catch (error) {
  console.error('Demo reset failed:', (error as Error).message)
  process.exitCode = 1
} finally {
  await pool.end()
}
