import { createHash } from 'node:crypto'
import { isIPv4, isIPv6 } from 'node:net'
import type { Request } from 'express'
import type pg from 'pg'
import { TooManyRequestsError } from '../errors.ts'

/**
 * Fixed-window rate limits for login and register, stored in Postgres (auth_rate_limits)
 * so every serverless instance shares the same counters. An in-memory limiter would only
 * count the requests that happened to reach one instance.
 */
export interface Rule {
  /** Part of the stored key; changing it starts every counter for the rule from zero */
  name: string
  limit: number
  windowSeconds: number
}

export const RULES = {
  /** Failed logins for one email (the public demo account is exempt) */
  loginPerEmail: { name: 'login-failures:email', limit: 10, windowSeconds: 15 * 60 },
  /** Failed logins from one IP address, any email */
  loginPerIp: { name: 'login-failures:ip', limit: 30, windowSeconds: 15 * 60 },
  /** Registration attempts from one IP address */
  registerPerIp: { name: 'register:ip', limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, Rule>

const LONGEST_WINDOW_SECONDS = Math.max(...Object.values(RULES).map((rule) => rule.windowSeconds))

export interface RateLimitOptions {
  /**
   * The request header that holds the client's IP address, set by a proxy we trust; when
   * unset, the TCP connection's address is used and no header is believed.
   * On Vercel this is "x-real-ip": Vercel's edge sets it from the connection it accepted
   * and doesn't pass through a value sent by the client, and functions are only reachable
   * through that edge. Anywhere else, trusting a header would let clients pick any IP.
   */
  clientIpHeader?: string
  /** Delete long-expired rows on every Nth limiter call (per instance); the daily cron also prunes */
  pruneEvery?: number
}

/** The stored key: a hash, so the table never holds plaintext emails or IP addresses */
const keyFor = (rule: Rule, subject: string) => createHash('sha256').update(`${rule.name}\0${subject}`).digest('base64url')

export function createRateLimiter(pool: pg.Pool, { clientIpHeader, pruneEvery = 50 }: RateLimitOptions = {}) {
  let calls = 0

  /**
   * Counts one attempt atomically and reports whether it's within the limit. A single
   * upsert either starts a window (count 1), starts a new one if the old window has ended,
   * or adds to the current one, so concurrent requests can't both see a stale count.
   */
  async function consume(rule: Rule, subject: string) {
    if (++calls % pruneEvery === 0) void prune().catch((error) => console.warn('Rate limit cleanup failed:', error))
    const {
      rows: [row],
    } = await pool.query<{ count: number; retry_after: number }>(
      `INSERT INTO auth_rate_limits AS l (key, window_start, count) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN l.window_start <= now() - make_interval(secs => $2) THEN 1 ELSE l.count + 1 END,
         window_start = CASE WHEN l.window_start <= now() - make_interval(secs => $2) THEN now() ELSE l.window_start END
       RETURNING count,
         greatest(1, ceil(extract(epoch FROM l.window_start + make_interval(secs => $2) - now())))::int AS retry_after`,
      [keyFor(rule, subject), rule.windowSeconds],
    )
    return { allowed: row.count <= rule.limit, retryAfterSeconds: row.retry_after }
  }

  /** Takes one attempt back (e.g. a login that turned out to be correct) */
  async function release(rule: Rule, subject: string) {
    await pool.query('UPDATE auth_rate_limits SET count = greatest(count - 1, 0) WHERE key = $1', [keyFor(rule, subject)])
  }

  /** Clears a counter (e.g. failed logins for an email, after a successful one) */
  async function reset(rule: Rule, subject: string) {
    await pool.query('DELETE FROM auth_rate_limits WHERE key = $1', [keyFor(rule, subject)])
  }

  /** Deletes rows whose window ended long ago; returns how many */
  async function prune() {
    const { rowCount } = await pool.query(
      'DELETE FROM auth_rate_limits WHERE window_start < now() - make_interval(secs => $1)',
      [LONGEST_WINDOW_SECONDS],
    )
    return rowCount ?? 0
  }

  /**
   * Counts the attempt against every rule; throws 429 if any is over its limit, with
   * Retry-After for the longest wait. `what` names the action in the message.
   */
  async function enforce(checks: [Rule, string][], what: string) {
    const results = await Promise.all(checks.map(([rule, subject]) => consume(rule, subject)))
    const blocked = results.filter((result) => !result.allowed)
    if (!blocked.length) return
    const wait = Math.max(...blocked.map((result) => result.retryAfterSeconds))
    const minutes = Math.ceil(wait / 60)
    throw new TooManyRequestsError(`Too many ${what}. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, wait)
  }

  return { enforce, consume, release, reset, prune, clientIp: (req: Request) => clientIp(req, clientIpHeader) }
}

export type RateLimiter = ReturnType<typeof createRateLimiter>

/** The client's address as a rate-limit subject (see RateLimitOptions.clientIpHeader) */
export function clientIp(req: Request, trustedHeader?: string): string {
  const fromHeader = trustedHeader ? req.get(trustedHeader)?.split(',')[0]?.trim() : undefined
  return normalizeIp(fromHeader || req.socket.remoteAddress || '')
}

/**
 * IPv4 as is (also when written as IPv4-mapped IPv6). IPv6 by its /64 prefix: one
 * customer usually gets a whole /64, so limiting single addresses would be easy to dodge.
 */
export function normalizeIp(raw: string): string {
  const ip = raw.split('%')[0].toLowerCase() // drop an IPv6 zone id
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip)
  if (mapped && isIPv4(mapped[1])) return mapped[1]
  if (isIPv4(ip)) return ip
  if (isIPv6(ip)) return `${expandIPv6(ip).slice(0, 4).join(':')}::/64`
  return 'unknown'
}

/** "2001:db8::1" -> ["2001", "db8", "0", "0", "0", "0", "0", "1"] */
function expandIPv6(ip: string): string[] {
  const [head, tail] = ip.split('::')
  const parts = (side: string | undefined) => (side ? side.split(':') : [])
  const left = parts(head)
  const right = parts(tail)
  // An embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) counts as two groups
  const last = right.length ? right : left
  if (last.length && last[last.length - 1].includes('.')) {
    const [a, b, c, d] = last.pop()!.split('.').map(Number)
    last.push(((a << 8) | b).toString(16), ((c << 8) | d).toString(16))
  }
  const missing = tail === undefined ? 0 : 8 - left.length - right.length
  // Canonical hex without leading zeros, so "0db8" and "db8" are the same group
  return [...left, ...Array(missing).fill('0'), ...right].map((group) => parseInt(group, 16).toString(16))
}
