import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { normalizeIp, RULES } from '../src/auth/rateLimit.ts'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/demo/account.ts'
import { withTransaction } from '../src/db/pool.ts'
import { resetDemo } from '../src/demo/board.ts'
import { startTestServer } from './helpers.ts'

const CRON_SECRET = 'rate-limit-test-cron-secret'
const PASSWORD = 'the right password'

// Trusts a test header for the client IP, so tests can act as many different clients
let t: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  t = await startTestServer({ cronSecret: CRON_SECRET, rateLimit: { clientIpHeader: 'x-test-ip' } })
})
after(async () => {
  await t?.stop()
})
beforeEach(async () => {
  await t.pool.query('TRUNCATE auth_rate_limits')
  await t.pool.query("DELETE FROM users WHERE email <> 'tester@example.com'")
})

/** A request from a given client IP; returns status, Retry-After and the JSON body */
async function send(baseUrl: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(baseUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  // Read loosely, like the helper client's responses
  const json: any = await res.json().catch(() => null)
  return { status: res.status, retryAfter: res.headers.get('retry-after'), body: json }
}
const login = (ip: string, email: string, password: string) => send(t.baseUrl, '/auth/login', { email, password }, { 'x-test-ip': ip })
const register = (ip: string, email: string) => send(t.baseUrl, '/auth/register', { email, password: PASSWORD }, { 'x-test-ip': ip })

async function makeUser(email: string) {
  // Straight into the database, so creating it doesn't use up a sign-up allowance
  const created = await t.client().api('POST', '/auth/register', { email, password: PASSWORD })
  assert.equal(created.status, 201)
  await t.pool.query('TRUNCATE auth_rate_limits')
}

describe('login rate limits', () => {
  it(`blocks an email after ${RULES.loginPerEmail.limit} failed attempts, with Retry-After`, async () => {
    await makeUser('ana@example.com')
    for (let i = 0; i < RULES.loginPerEmail.limit; i++) {
      assert.equal((await login('10.0.0.1', 'ana@example.com', 'wrong')).status, 401)
    }
    const blocked = await login('10.0.0.1', 'ana@example.com', 'wrong')
    assert.equal(blocked.status, 429)
    assert.match(blocked.body.error, /^Too many login attempts\. Try again in 15 minutes\.$/)
    const wait = Number(blocked.retryAfter)
    assert.ok(wait > 14 * 60 && wait <= 15 * 60, `Retry-After ${wait}s`)

    // Even the right password is refused while blocked (otherwise guessing could continue)
    assert.equal((await login('10.0.0.1', 'ana@example.com', PASSWORD)).status, 429)
    // The limit is per email: the same IP can still try another account
    assert.equal((await login('10.0.0.1', 'other@example.com', 'wrong')).status, 401)
  })

  it('treats the email case- and space-insensitively', async () => {
    await makeUser('ana@example.com')
    for (let i = 0; i < RULES.loginPerEmail.limit; i++) await login('10.0.0.2', i % 2 ? '  ANA@example.com ' : 'ana@EXAMPLE.com', 'wrong')
    assert.equal((await login('10.0.0.2', 'ana@example.com', 'wrong')).status, 429)
  })

  it(`blocks an IP after ${RULES.loginPerIp.limit} failed attempts across any emails`, async () => {
    for (let i = 0; i < RULES.loginPerIp.limit; i++) {
      assert.equal((await login('10.0.0.3', `guess${i}@example.com`, 'wrong')).status, 401)
    }
    assert.equal((await login('10.0.0.3', 'fresh@example.com', 'wrong')).status, 429)
    // Another client is unaffected
    assert.equal((await login('10.0.0.4', 'fresh@example.com', 'wrong')).status, 401)
  })

  it('forgives failures after a successful login', async () => {
    await makeUser('ana@example.com')
    for (let i = 0; i < RULES.loginPerEmail.limit - 1; i++) await login('10.0.0.5', 'ana@example.com', 'wrong')
    assert.equal((await login('10.0.0.5', 'ana@example.com', PASSWORD)).status, 200)
    // The account's count started over: a full set of failures is allowed again
    for (let i = 0; i < RULES.loginPerEmail.limit; i++) {
      assert.equal((await login('10.0.0.5', 'ana@example.com', 'wrong')).status, 401)
    }
    assert.equal((await login('10.0.0.5', 'ana@example.com', 'wrong')).status, 429)
  })

  it('does not count successful logins against the IP', async () => {
    await makeUser('ana@example.com')
    for (let i = 0; i < RULES.loginPerIp.limit + 5; i++) {
      assert.equal((await login('10.0.0.6', 'ana@example.com', PASSWORD)).status, 200)
    }
  })

  it('exempts the public demo account from the per-email limit (not from the per-IP one)', async () => {
    await withTransaction(t.pool, (client) => resetDemo(client, { bcryptRounds: 4 }))
    // Different visitors mistyping the published password must not lock everyone out
    for (let i = 0; i < RULES.loginPerEmail.limit + 5; i++) {
      assert.equal((await login(`10.1.0.${i}`, DEMO_EMAIL, 'wrong')).status, 401)
    }
    assert.equal((await login('10.1.1.1', DEMO_EMAIL, DEMO_PASSWORD)).status, 200)
    // One client hammering it still hits the IP limit
    for (let i = 0; i < RULES.loginPerIp.limit; i++) await login('10.0.0.7', DEMO_EMAIL, 'wrong')
    assert.equal((await login('10.0.0.7', DEMO_EMAIL, DEMO_PASSWORD)).status, 429)
  })

  it('cannot be beaten by sending attempts in parallel', async () => {
    await makeUser('ana@example.com')
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => login(`10.2.0.${i}`, 'ana@example.com', 'wrong')))
    const statuses = results.map((r) => r.status)
    assert.equal(statuses.filter((s) => s === 401).length, RULES.loginPerEmail.limit, statuses.join(' '))
    assert.equal(statuses.filter((s) => s === 429).length, 25 - RULES.loginPerEmail.limit)
  })

  it('starts a new window once the old one has ended', async () => {
    await makeUser('ana@example.com')
    for (let i = 0; i < RULES.loginPerEmail.limit + 1; i++) await login('10.0.0.8', 'ana@example.com', 'wrong')
    assert.equal((await login('10.0.0.8', 'ana@example.com', 'wrong')).status, 429)
    // 16 minutes later
    await t.pool.query("UPDATE auth_rate_limits SET window_start = window_start - interval '16 minutes'")
    assert.equal((await login('10.0.0.8', 'ana@example.com', 'wrong')).status, 401)
  })
})

describe('register rate limit', () => {
  it(`allows ${RULES.registerPerIp.limit} sign-up attempts per IP per hour`, async () => {
    for (let i = 0; i < RULES.registerPerIp.limit; i++) {
      assert.equal((await register('10.3.0.1', `new${i}@example.com`)).status, 201)
    }
    const blocked = await register('10.3.0.1', 'one-more@example.com')
    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.error, 'Too many sign-up attempts. Try again in 60 minutes.')
    const wait = Number(blocked.retryAfter)
    assert.ok(wait > 59 * 60 && wait <= 60 * 60, `Retry-After ${wait}s`)
    // Nothing was created by the refused attempt
    const { rowCount } = await t.pool.query("SELECT 1 FROM users WHERE email = 'one-more@example.com'")
    assert.equal(rowCount, 0)
    // Another client can still sign up
    assert.equal((await register('10.3.0.2', 'someone@example.com')).status, 201)
  })
})

describe('storage', () => {
  it('stores hashed keys only, never emails or IP addresses', async () => {
    await login('10.4.0.1', 'private@example.com', 'wrong')
    const { rows } = await t.pool.query<{ key: string }>('SELECT key FROM auth_rate_limits')
    assert.equal(rows.length, 2)
    for (const { key } of rows) {
      assert.match(key, /^[A-Za-z0-9_-]{43}$/) // base64url SHA-256
      assert.ok(!key.includes('private') && !key.includes('10.4.0.1'))
    }
  })

  it('the daily cron prunes windows that ended long ago, and keeps current ones', async () => {
    await login('10.4.0.2', 'old@example.com', 'wrong')
    await t.pool.query("UPDATE auth_rate_limits SET window_start = now() - interval '2 hours'")
    await login('10.4.0.3', 'new@example.com', 'wrong')

    const res = await fetch(`${t.baseUrl}/demo/reset`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
    assert.equal(res.status, 200)
    assert.equal(((await res.json()) as { prunedRateLimits: number }).prunedRateLimits, 2)
    const { rows } = await t.pool.query('SELECT count(*)::int AS n FROM auth_rate_limits')
    assert.equal(rows[0].n, 2)
  })
})

describe('client IP', () => {
  it('ignores client-supplied headers unless the server is told to trust one', async () => {
    // A server with no trusted header: rotating X-Forwarded-For / X-Real-IP doesn't escape
    const plain = await startTestServer({ rateLimit: {} })
    try {
      for (let i = 0; i < RULES.loginPerIp.limit; i++) {
        const spoofed = { 'x-forwarded-for': `203.0.113.${i}`, 'x-real-ip': `198.51.100.${i}` }
        assert.equal((await send(plain.baseUrl, '/auth/login', { email: `g${i}@example.com`, password: 'x' }, spoofed)).status, 401)
      }
      const last = await send(plain.baseUrl, '/auth/login', { email: 'z@example.com', password: 'x' }, { 'x-forwarded-for': '192.0.2.99' })
      assert.equal(last.status, 429)
    } finally {
      await plain.stop()
    }
  })

  it('normalizes addresses: IPv4, IPv4-mapped IPv6, and IPv6 by /64', () => {
    assert.equal(normalizeIp('203.0.113.7'), '203.0.113.7')
    assert.equal(normalizeIp('::ffff:203.0.113.7'), '203.0.113.7')
    // One /64 is usually one customer: addresses inside it share a counter
    assert.equal(normalizeIp('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64')
    assert.equal(normalizeIp('2001:0DB8:0001:0002:bbbb:cccc:dddd:eeee'), '2001:db8:1:2::/64')
    assert.equal(normalizeIp('2001:db8::1'), '2001:db8:0:0::/64')
    assert.equal(normalizeIp('fe80::1%eth0'), 'fe80:0:0:0::/64')
    assert.notEqual(normalizeIp('2001:db8:1:3::1'), normalizeIp('2001:db8:1:2::1'))
    assert.equal(normalizeIp('not an ip'), 'unknown')
    assert.equal(normalizeIp(''), 'unknown')
  })
})
