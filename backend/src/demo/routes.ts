import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type pg from 'pg'
import { withTransaction } from '../db/pool.ts'
import { notFound, HttpError } from '../errors.ts'
import { resetDemo } from './board.ts'

/**
 * GET /api/demo/reset restores the demo board. Vercel's cron calls it daily with
 * "Authorization: Bearer <CRON_SECRET>". Without a CRON_SECRET the route doesn't exist.
 */
export function demoRoutes(pool: pg.Pool, { cronSecret, bcryptRounds }: { cronSecret?: string; bcryptRounds: number }) {
  const router = Router()

  router.get('/demo/reset', async (req, res) => {
    if (!cronSecret) throw notFound('Not found')
    const expected = Buffer.from(`Bearer ${cronSecret}`)
    const given = Buffer.from(req.get('authorization') ?? '')
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new HttpError(401, 'Not authorized')
    }
    const boardId = await withTransaction(pool, (client) => resetDemo(client, { bcryptRounds }))
    res.json({ reset: true, boardId })
  })

  return router
}
