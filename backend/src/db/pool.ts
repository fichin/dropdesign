import pg from 'pg'

/**
 * Neon's connection string includes sslmode, which pg picks up for TLS.
 * `searchPath` puts the tables in a specific schema; tests use it to run against
 * a throwaway schema (needs a direct, non-pooled connection: PgBouncer drops it).
 */
export function createPool(connectionString: string, { searchPath }: { searchPath?: string } = {}) {
  if (searchPath && !/^[a-z_][a-z0-9_]*$/.test(searchPath)) {
    throw new Error(`Invalid schema name: ${searchPath}`)
  }
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    // Neon may close idle connections; let pg drop them before that happens
    idleTimeoutMillis: 30_000,
    ...(searchPath && { options: `-c search_path=${searchPath}` }),
  })

  // An idle client erroring (e.g. the server closed it) shouldn't crash the process
  pool.on('error', (error) => {
    console.error('Postgres pool error:', error.message)
  })
  return pool
}

/** Runs `work` inside a transaction, rolling back if it throws */
export async function withTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    // If the connection itself broke, ROLLBACK fails too; report the original error
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
