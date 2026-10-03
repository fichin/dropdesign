import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { Board, Task } from '../../shared/kanban.ts'
import { assertConsistent, lookup, startTestServer, titlesByColumn } from './helpers.ts'

const SAMPLE_TASKS = 11
let t: Awaited<ReturnType<typeof startTestServer>>
let board: Board
let ids: ReturnType<typeof lookup>

before(async () => {
  t = await startTestServer()
})
after(async () => {
  await t?.stop()
})
beforeEach(async () => {
  board = await t.resetBoard()
  ids = lookup(board)
})

const getBoard = async () => (await t.api<Board>('GET', `/boards/${board.id}`)).body
const update = (taskId: string, body: unknown) => t.api<Task>('PATCH', `/tasks/${taskId}`, body)
const person = (firstName: string) => {
  const found = board.people.find((p) => p.name.startsWith(firstName))
  assert.ok(found, `no person ${firstName}`)
  return found.id
}

describe('PATCH /api/tasks/:taskId', () => {
  it('updates title, description and priority, and the change is in the board', async () => {
    const task = ids.task('Machine Learning')
    const { status, body } = await update(task, {
      title: '  ML: train the model  ',
      description: 'Line one\nLine two',
      priority: 'high-priority',
    })
    assert.equal(status, 200)
    assert.equal(body.title, 'ML: train the model', 'title is trimmed')
    assert.equal(body.description, 'Line one\nLine two', 'description keeps line breaks')
    assert.equal(body.priority, 'high-priority')

    const saved = (await getBoard()).tasks[task]
    assert.deepEqual(
      { title: saved.title, description: saved.description, priority: saved.priority },
      { title: 'ML: train the model', description: 'Line one\nLine two', priority: 'high-priority' },
    )
  })

  it('leaves fields that are not sent unchanged', async () => {
    const task = ids.task('Machine Learning')
    const before = board.tasks[task]
    const { body } = await update(task, { description: 'Only this' })
    assert.equal(body.title, before.title)
    assert.equal(body.priority, before.priority)
    assert.equal(body.progress, before.progress)
    assert.deepEqual(body.assignees, before.assignees)
    assert.equal(body.description, 'Only this')
  })

  it('replaces the assignees, keeping the given order, and can clear them', async () => {
    const task = ids.task('UI/UX')
    const { body } = await update(task, { assigneeIds: [person('Mia'), person('Ana'), person('Luka')] })
    assert.deepEqual(body.assignees.map((a) => a.name.split(' ')[0]), ['Mia', 'Ana', 'Luka'])
    assert.deepEqual((await getBoard()).tasks[task].assignees.map((a) => a.name.split(' ')[0]), ['Mia', 'Ana', 'Luka'])

    const cleared = await update(task, { assigneeIds: [] })
    assert.deepEqual(cleared.body.assignees, [])
    // People themselves are untouched
    assert.equal((await getBoard()).people.length, 7)
  })

  it('rejects invalid input without changing anything', async () => {
    const task = ids.task('UI/UX')
    const checks: [string, unknown][] = [
      ['empty title', { title: '   ' }],
      ['title too long', { title: 'x'.repeat(501) }],
      ['description too long', { description: 'x'.repeat(5001) }],
      ['unknown priority', { priority: 'urgent' }],
      ['nothing to update', {}],
      ['unknown field', { progress: 100 }],
      ['assignee not a uuid', { assigneeIds: ['bob'] }],
      ['same person twice', { assigneeIds: [person('Ana'), person('Ana')] }],
      ['person who does not exist', { assigneeIds: [randomUUID()] }],
    ]
    for (const [label, body] of checks) {
      assert.equal((await update(task, body)).status, 400, label)
    }
    assert.deepEqual((await getBoard()).tasks[task], board.tasks[task])
  })

  it('404s for an unknown task and 400s for a malformed id', async () => {
    assert.equal((await update(randomUUID(), { title: 'x' })).status, 404)
    assert.equal((await update('nope', { title: 'x' })).status, 400)
  })

  it('needs a session', async () => {
    const task = ids.task('UI/UX')
    const res = await t.client().api('PATCH', `/tasks/${task}`, { title: 'Hijacked' })
    assert.equal(res.status, 401)
    assert.equal((await getBoard()).tasks[task].title, board.tasks[task].title)
  })
})

describe('due dates (PATCH /api/tasks/:taskId)', () => {
  it('starts without one, can be set, and shows up in board reads', async () => {
    const task = ids.task('Machine Learning')
    assert.equal(board.tasks[task].dueDate, null)

    const { status, body } = await update(task, { dueDate: '2026-10-15' })
    assert.equal(status, 200)
    assert.equal(body.dueDate, '2026-10-15', 'comes back exactly as sent, with no time or timezone shift')
    assert.equal((await getBoard()).tasks[task].dueDate, '2026-10-15')
  })

  it('can be changed and cleared with null', async () => {
    const task = ids.task('UI/UX')
    await update(task, { dueDate: '2026-10-15' })
    assert.equal((await update(task, { dueDate: '2027-01-02' })).body.dueDate, '2027-01-02')

    const cleared = await update(task, { dueDate: null })
    assert.equal(cleared.status, 200)
    assert.equal(cleared.body.dueDate, null)
    assert.equal((await getBoard()).tasks[task].dueDate, null)
  })

  it('leaves the due date alone when other fields change, and vice versa', async () => {
    const task = ids.task('Learn Computer')
    await update(task, { dueDate: '2026-12-24' })
    const renamed = await update(task, { title: 'Learn CS' })
    assert.equal(renamed.body.dueDate, '2026-12-24')

    const before = (await getBoard()).tasks[task]
    const dated = await update(task, { dueDate: '2026-12-31' })
    assert.deepEqual({ ...dated.body, dueDate: before.dueDate }, before, 'only the due date changed')
  })

  it('survives moving the task', async () => {
    const task = ids.task('UI/UX')
    await update(task, { dueDate: '2026-11-05' })
    const moved = await t.api('PATCH', `/tasks/${task}/move`, { toColumnId: ids.column('Completed'), toIndex: 0 })
    assert.equal(moved.body.task.dueDate, '2026-11-05')
  })

  it('accepts 29 February only in leap years', async () => {
    const task = ids.task('UI/UX')
    assert.equal((await update(task, { dueDate: '2028-02-29' })).status, 200)
    assert.equal((await update(task, { dueDate: '2027-02-29' })).status, 400)
  })

  it('rejects anything that is not a real YYYY-MM-DD date, without changing the task', async () => {
    const task = ids.task('UI/UX')
    await update(task, { dueDate: '2026-10-15' })
    const invalid: unknown[] = [
      '2026-02-30',
      '2026-13-01',
      '15/10/2026',
      '2026-10-15T00:00:00Z',
      'tomorrow',
      '',
      20261015,
      true,
    ]
    for (const dueDate of invalid) {
      assert.equal((await update(task, { dueDate })).status, 400, JSON.stringify(dueDate))
    }
    assert.equal((await getBoard()).tasks[task].dueDate, '2026-10-15')
  })
})

describe('DELETE /api/tasks/:taskId', () => {
  it('deletes the task and closes the gap in its column', async () => {
    const todo = ids.column('To Do')
    const { status, body } = await t.api('DELETE', `/tasks/${ids.task('Responsive')}`)
    assert.equal(status, 200)
    assert.deepEqual(Object.keys(body.columns), [todo])

    const after = await getBoard()
    assert.deepEqual(titlesByColumn(after)['To Do'], ['UI/UX Design', 'Blog Copywri', 'Landing page'])
    assert.equal(after.tasks[ids.task('Responsive')], undefined)
    assert.deepEqual(body.columns[todo], after.columns[todo].taskIds)
    await assertConsistent(t.pool, SAMPLE_TASKS - 1)

    // Its assignee links went with it; the people remain
    const { rows } = await t.pool.query('SELECT count(*)::int AS n FROM task_assignees WHERE task_id = $1', [
      ids.task('Responsive'),
    ])
    assert.equal(rows[0].n, 0)
    assert.equal(after.people.length, 7)
  })

  it('404s the second time, and for unknown tasks', async () => {
    const task = ids.task('Landing page')
    assert.equal((await t.api('DELETE', `/tasks/${task}`)).status, 200)
    assert.equal((await t.api('DELETE', `/tasks/${task}`)).status, 404)
    assert.equal((await t.api('DELETE', `/tasks/${randomUUID()}`)).status, 404)
    assert.equal((await t.api('DELETE', '/tasks/nope')).status, 400)
    await assertConsistent(t.pool, SAMPLE_TASKS - 1)
  })

  it('needs a session', async () => {
    assert.equal((await t.client().api('DELETE', `/tasks/${ids.task('UI/UX')}`)).status, 401)
    await assertConsistent(t.pool, SAMPLE_TASKS)
  })

  it('stays consistent when deletes, moves and edits arrive at once', async () => {
    const taskIds = Object.keys(board.tasks)
    const toDelete = taskIds.slice(0, 4)
    const others = taskIds.slice(4)
    const results = await Promise.all([
      ...toDelete.map((id) => t.api('DELETE', `/tasks/${id}`)),
      ...others.map((id, i) =>
        i % 2
          ? t.api('PATCH', `/tasks/${id}/move`, { toColumnId: board.columnOrder[i % 3], toIndex: 0 })
          : update(id, { title: `Edited ${i}` }),
      ),
    ])
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)))
    await assertConsistent(t.pool, SAMPLE_TASKS - toDelete.length)
  })
})
