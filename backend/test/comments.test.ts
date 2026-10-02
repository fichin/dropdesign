import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Board, Comment } from '../../shared/kanban.ts'
import { initialsAvatar, nameFromEmail } from '../../shared/people.ts'
import { lookup, startTestServer } from './helpers.ts'

let t: Awaited<ReturnType<typeof startTestServer>>
let board: Board
let taskId: string

before(async () => {
  t = await startTestServer()
})
after(async () => {
  await t?.stop()
})
beforeEach(async () => {
  board = await t.resetBoard()
  taskId = lookup(board).task('Machine Learning')
  // Comments and the people created for commenters go with the board reset (TRUNCATE people
  // CASCADE); remove other test accounts too
  await t.pool.query("DELETE FROM users WHERE email <> 'tester@example.com'")
})

const post = (body: unknown, task = taskId, api = t.api) => api<{ comment: Comment; commentCount: number }>('POST', `/tasks/${task}/comments`, body)
const list = (task = taskId, api = t.api) => api<Comment[]>('GET', `/tasks/${task}/comments`)
const commentCount = async () => (await t.api<Board>('GET', `/boards/${board.id}`)).body.tasks[taskId].commentCount

/** A second signed-in account, for "someone else's comment" */
async function otherUser() {
  const browser = t.client()
  await browser.api('POST', '/auth/register', { email: 'sam.lee@example.com', password: 'another fine password' })
  return browser.api
}

describe('POST /api/tasks/:taskId/comments', () => {
  it('adds a comment as the signed-in user and updates the task count', async () => {
    const id = randomUUID()
    const { status, body } = await post({ id, body: '  Looks good to me  ' })
    assert.equal(status, 201)
    assert.equal(body.comment.id, id)
    assert.equal(body.comment.body, 'Looks good to me', 'body is trimmed')
    assert.equal(body.comment.taskId, taskId)
    assert.equal(body.commentCount, 1)
    assert.ok(!Number.isNaN(Date.parse(body.comment.createdAt)))

    // The author is a person made for this account, named from the email
    const me = (await t.api('GET', '/auth/me')).body
    assert.equal(body.comment.authorUserId, me.id)
    assert.equal(body.comment.author.name, 'Tester')
    assert.match(body.comment.author.avatarUrl, /^data:image\/svg\+xml,/)
    assert.equal(await commentCount(), 1)
  })

  it('reuses the same person for every comment by an account', async () => {
    const first = await post({ id: randomUUID(), body: 'One' })
    const second = await post({ id: randomUUID(), body: 'Two' })
    assert.equal(first.body.comment.author.id, second.body.comment.author.id)
    const { rows } = await t.pool.query('SELECT count(*)::int AS n FROM people WHERE user_id IS NOT NULL')
    assert.equal(rows[0].n, 1)
  })

  it('treats a retried request as the same comment', async () => {
    const payload = { id: randomUUID(), body: 'Only once' }
    assert.equal((await post(payload)).status, 201)
    const retry = await post(payload)
    assert.equal(retry.status, 200)
    assert.equal(retry.body.commentCount, 1)
    assert.equal((await list()).body.length, 1)
    assert.equal((await post({ ...payload, body: 'Different' })).status, 409)
  })

  it('validates the body', async () => {
    const checks: [string, unknown][] = [
      ['empty', { id: randomUUID(), body: '' }],
      ['only spaces', { id: randomUUID(), body: '   \n ' }],
      ['too long', { id: randomUUID(), body: 'x'.repeat(2001) }],
      ['missing body', { id: randomUUID() }],
      ['bad id', { id: 'nope', body: 'Hi' }],
      ['unknown field', { id: randomUUID(), body: 'Hi', authorId: randomUUID() }],
    ]
    for (const [label, body] of checks) assert.equal((await post(body)).status, 400, label)
    assert.equal((await post({ id: randomUUID(), body: 'x'.repeat(2000) })).status, 201, '2000 characters is allowed')
    assert.equal(await commentCount(), 1)
  })

  it('404s for a task that does not exist', async () => {
    assert.equal((await post({ id: randomUUID(), body: 'Hello?' }, randomUUID())).status, 404)
  })
})

describe('GET /api/tasks/:taskId/comments', () => {
  it('lists comments oldest first, with each author', async () => {
    const sam = await otherUser()
    await post({ id: randomUUID(), body: 'First' })
    await post({ id: randomUUID(), body: 'Second' }, taskId, sam)
    await post({ id: randomUUID(), body: 'Third' })

    const { status, body } = await list()
    assert.equal(status, 200)
    assert.deepEqual(body.map((c) => c.body), ['First', 'Second', 'Third'])
    assert.deepEqual(body.map((c) => c.author.name), ['Tester', 'Sam Lee', 'Tester'])
    assert.equal(await commentCount(), 3)
  })

  it('is empty for a task without comments, and 404s for one that does not exist', async () => {
    assert.deepEqual((await list()).body, [])
    assert.equal((await list(randomUUID())).status, 404)
  })
})

describe('DELETE /api/comments/:commentId', () => {
  it('deletes your own comment and updates the count', async () => {
    const keep = await post({ id: randomUUID(), body: 'Keep' })
    const remove = await post({ id: randomUUID(), body: 'Remove' })
    const { status, body } = await t.api('DELETE', `/comments/${remove.body.comment.id}`)
    assert.equal(status, 200)
    assert.deepEqual(body, { taskId, commentCount: 1 })
    assert.deepEqual((await list()).body.map((c) => c.id), [keep.body.comment.id])
    assert.equal(await commentCount(), 1)
  })

  it("403s for someone else's comment and leaves it alone", async () => {
    const sam = await otherUser()
    const theirs = await post({ id: randomUUID(), body: "Sam's comment" }, taskId, sam)
    const res = await t.api('DELETE', `/comments/${theirs.body.comment.id}`)
    assert.equal(res.status, 403)
    assert.deepEqual(res.body, { error: 'You can only delete your own comments' })
    assert.equal((await list()).body.length, 1)
    assert.equal(await commentCount(), 1)
  })

  it('404s for a comment that does not exist (or is already deleted)', async () => {
    const mine = await post({ id: randomUUID(), body: 'Twice' })
    assert.equal((await t.api('DELETE', `/comments/${mine.body.comment.id}`)).status, 200)
    assert.equal((await t.api('DELETE', `/comments/${mine.body.comment.id}`)).status, 404)
    assert.equal((await t.api('DELETE', `/comments/${randomUUID()}`)).status, 404)
    assert.equal((await t.api('DELETE', '/comments/nope')).status, 400)
  })
})

describe('comments need a session', () => {
  it('401 for list, add and delete without signing in, and nothing changes', async () => {
    const mine = await post({ id: randomUUID(), body: 'Mine' })
    const anon = t.client().api
    const results = await Promise.all([
      anon('GET', `/tasks/${taskId}/comments`),
      anon('POST', `/tasks/${taskId}/comments`, { id: randomUUID(), body: 'Sneaky' }),
      anon('DELETE', `/comments/${mine.body.comment.id}`),
      anon('GET', `/tasks/${randomUUID()}/comments`),
    ])
    for (const res of results) assert.equal(res.status, 401)
    assert.equal((await list()).body.length, 1)
    assert.equal(await commentCount(), 1)
  })
})

describe('comments and tasks', () => {
  it("deleting a task deletes its comments", async () => {
    await post({ id: randomUUID(), body: 'Gone soon' })
    assert.equal((await t.api('DELETE', `/tasks/${taskId}`)).status, 200)
    const { rows } = await t.pool.query('SELECT count(*)::int AS n FROM comments')
    assert.equal(rows[0].n, 0)
  })

  it('keeps the count exact when many comments are added and deleted at once', async () => {
    const ids = Array.from({ length: 12 }, () => randomUUID())
    await Promise.all(ids.map((id, i) => post({ id, body: `Burst ${i}` })))
    await Promise.all(ids.slice(0, 5).map((id) => t.api('DELETE', `/comments/${id}`)))
    assert.equal(await commentCount(), 7)
    assert.equal((await list()).body.length, 7)
  })
})

describe('author names and avatars', () => {
  it('names people from their email and draws initials avatars', () => {
    assert.equal(nameFromEmail('ana.petrova@example.com'), 'Ana Petrova')
    assert.equal(nameFromEmail('mia_jovanovska+work@example.com'), 'Mia Jovanovska')
    assert.equal(nameFromEmail('x@example.com'), 'X')
    const avatar = decodeURIComponent(initialsAvatar('Ana Petrova'))
    assert.match(avatar, />AP<\/text>/)
    assert.doesNotMatch(decodeURIComponent(initialsAvatar('<script> x')), /<script>/, 'only letters and digits end up in the SVG')
  })
})
