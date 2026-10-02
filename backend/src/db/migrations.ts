import { readdir, readFile } from 'node:fs/promises'
import type pg from 'pg'

const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url)
// Any fixed number: stops two deploys from migrating at the same time
const MIGRATION_LOCK_ID = 4_815_162_342

/**
 * Applies the .sql files in backend/migrations that haven't run yet, in filename
 * order, each in its own transaction. Returns the names of the files applied.
 */
export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect()
  try {
    await lockedTransaction(client, () =>
      client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name        text PRIMARY KEY,
          applied_at  timestamptz NOT NULL DEFAULT now()
        )
      `),
    )

    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort()
    const appliedNow: string[] = []

    for (const file of files) {
      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8')
      const applied = await lockedTransaction(client, async () => {
        // Checked inside the locked transaction, so a concurrent run can't apply it twice
        const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file])
        if (rowCount) return false
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        return true
      }).catch((error: Error) => {
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error })
      })
      if (applied) appliedNow.push(file)
    }
    return appliedNow
  } finally {
    client.release()
  }
}

/**
 * Runs `work` in a transaction holding the migration lock. The lock is
 * transaction-scoped (pg_advisory_xact_lock) rather than session-scoped, because
 * Neon's pooled connection string (PgBouncer, transaction mode) doesn't keep a
 * session on the same server connection between transactions.
 */
async function lockedTransaction<T>(client: pg.PoolClient, work: () => Promise<T>): Promise<T> {
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID])
    const result = await work()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}
