import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Board } from '../../shared/kanban.ts'
import { withTransaction } from '../src/db/pool.ts'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/demo/account.ts'
import { resetDemo } from '../src/demo/board.ts'
import { lookup, startTestServer } from './helpers.ts'

const CRON_SECRET = 'test-cron-secret-0123456789'

let t: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  t = await startTestServer({ cronSecret: CRON_SECRET })
})
after(async () => {
  await t?.stop()
})
beforeEach(async () => {
  await t.pool.query("DELETE FROM users WHERE email <> 'tester@example.com'")
  await withTransaction(t.pool, (client) => resetDemo(client, { bcryptRounds: 4 }))
})

/** A browser signed in with "Try Demo", plus the board it sees */
async function demoBrowser() {
  const browser = t.client()
  const signedIn = await browser.api('POST', '/auth/demo')
  assert.equal(signedIn.status, 200)
  const [{ id }] = (await browser.api('GET', '/boards')).body
  const board = (await browser.api<Board>('GET', `/boards/${id}`)).body
  return { browser, board, user: signedIn.body }
}

describe('demo account', () => {
  it('"Try Demo" signs in as the demo account without a password', async () => {
    const browser = t.client()
    const { status, body, setCookies } = await browser.api('POST', '/auth/demo')
    assert.equal(status, 200)
    assert.deepEqual({ email: body.email, demo: body.demo }, { email: DEMO_EMAIL, demo: true })
    assert.ok(setCookies.some((c) => c.startsWith('kanban_session=')))
    assert.equal((await browser.api('GET', '/auth/me')).body.demo, true)
  })

  it('also works by typing the published credentials', async () => {
    const { status, body } = await t.client().api('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD })
    assert.equal(status, 200)
    assert.equal(body.demo, true)
  })

  it('answers 404 when the server has no demo account', async () => {
    await t.pool.query('DELETE FROM users WHERE email = $1', [DEMO_EMAIL])
    const { status, body } = await t.client().api('POST', '/auth/demo')
    assert.equal(status, 404)
    assert.match(body.error, /demo isn't set up/)
  })

  it('starts with a populated board: tasks in every column, details and comments', async () => {
    const { board } = await demoBrowser()
    const counts = board.columnOrder.map((id) => board.columns[id].taskIds.length)
    assert.deepEqual(counts, [3, 4, 4])
    const tasks = Object.values(board.tasks)
    assert.ok(tasks.some((task) => task.dueDate && task.progress < 100 && task.dueDate < new Date().toISOString().slice(0, 10)), 'something is overdue')
    assert.ok(tasks.filter((task) => task.description).length >= 5, 'most tasks have descriptions')

    const pricing = lookup(board).task('Redesign the pricing page')
    assert.equal(board.tasks[pricing].commentCount, 2)
    const comments = (await t.api('GET', `/tasks/${pricing}/comments`)).body
    assert.deepEqual(comments.map((c: { author: { name: string } }) => c.author.name), ['Marko Ilievski', 'Ana Petrova'])
  })

  it('can move, edit and comment, but not delete tasks', async () => {
    const { browser, board } = await demoBrowser()
    const { task, column } = lookup(board)
    const taskId = task('Write release notes for v2.3')

    assert.equal((await browser.api('PATCH', `/tasks/${taskId}/move`, { toColumnId: column('In Progress'), toIndex: 0 })).status, 200)
    assert.equal((await browser.api('PATCH', `/tasks/${taskId}`, { priority: 'meh' })).status, 200)
    const comment = await browser.api('POST', `/tasks/${taskId}/comments`, { id: crypto.randomUUID(), body: 'Trying the demo' })
    assert.equal(comment.status, 201)

    const deleted = await browser.api('DELETE', `/tasks/${taskId}`)
    assert.equal(deleted.status, 403)
    assert.equal(deleted.body.error, "The demo account can't delete tasks")
    const after = (await browser.api<Board>('GET', `/boards/${board.id}`)).body
    assert.ok(after.tasks[taskId], 'the task is still there')
  })

  it('does not stop other accounts from deleting', async () => {
    const { board } = await demoBrowser()
    const taskId = lookup(board).task('Write release notes for v2.3')
    assert.equal((await t.api('DELETE', `/tasks/${taskId}`)).status, 200)
  })
})

describe('GET /api/demo/reset', () => {
  const reset = (authorization?: string) =>
    fetch(`${t.baseUrl}/demo/reset`, { headers: authorization ? { Authorization: authorization } : {} })

  it('refuses requests without the cron secret', async () => {
    assert.equal((await reset()).status, 401)
    assert.equal((await reset('Bearer wrong-secret')).status, 401)
    assert.equal((await reset(CRON_SECRET)).status, 401, 'needs the Bearer prefix')
  })

  it('restores the demo board and keeps other accounts', async () => {
    const { browser, board } = await demoBrowser()
    const taskId = lookup(board).task('Redesign the pricing page')
    await browser.api('PATCH', `/tasks/${taskId}`, { title: 'Vandalised' })
    await browser.api('POST', `/tasks/${taskId}/comments`, { id: crypto.randomUUID(), body: 'Demo visitor was here' })

    const res = await reset(`Bearer ${CRON_SECRET}`)
    assert.equal(res.status, 200)

    const { board: restored } = await demoBrowser()
    const titles = Object.values(restored.tasks).map((task) => task.title)
    assert.ok(titles.includes('Redesign the pricing page'))
    assert.ok(!titles.includes('Vandalised'))
    // The person created for the demo visitor's comment is gone too
    assert.ok(!restored.people.some((person) => person.name === 'Demo'))
    // The regular test account still works
    assert.equal((await t.api('GET', '/auth/me')).status, 200)
  })

  it("doesn't exist on servers without a cron secret", async () => {
    const plain = await startTestServer()
    try {
      const res = await fetch(`${plain.baseUrl}/demo/reset`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
      assert.equal(res.status, 404)
    } finally {
      await plain.stop()
    }
  })
})
