import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { Assignee } from '../../../shared/kanban.ts'
import { initialBoard } from '../../../shared/sampleBoard.ts'

/**
 * Inserts the sample board (shared/sampleBoard.ts) with fresh UUIDs and returns its id.
 * Uses a few batched inserts (unnest) rather than one query per row, since every
 * round trip to a hosted database costs time.
 */
export async function insertSampleBoard(client: pg.PoolClient | pg.Pool): Promise<string> {
  // The sample uses short ids like "t1"; the database uses UUIDs
  const newIds = new Map<string, string>()
  const idFor = (sampleId: string) => {
    if (!newIds.has(sampleId)) newIds.set(sampleId, randomUUID())
    return newIds.get(sampleId)!
  }

  const boardId = randomUUID()
  await client.query('INSERT INTO boards (id, title) VALUES ($1, $2)', [boardId, initialBoard.title])

  const people = new Map<string, Assignee>()
  for (const task of Object.values(initialBoard.tasks)) {
    for (const person of task.assignees) people.set(person.id, person)
  }
  const peopleList = [...people.values()]
  await client.query(
    'INSERT INTO people (id, name, avatar_url) SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[])',
    [peopleList.map((p) => idFor(p.id)), peopleList.map((p) => p.name), peopleList.map((p) => p.avatarUrl)],
  )

  const columns = initialBoard.columnOrder.map((id, position) => ({ ...initialBoard.columns[id], position }))
  await client.query(
    `INSERT INTO columns (id, board_id, title, status, position)
     SELECT id, $1, title, status, position FROM unnest($2::uuid[], $3::text[], $4::text[], $5::int[])
       AS c(id, title, status, position)`,
    [
      boardId,
      columns.map((c) => idFor(c.id)),
      columns.map((c) => c.title),
      columns.map((c) => c.status),
      columns.map((c) => c.position),
    ],
  )

  const tasks = columns.flatMap((column) =>
    column.taskIds.map((taskId, position) => ({ ...initialBoard.tasks[taskId], columnId: column.id, position })),
  )
  await client.query(
    `INSERT INTO tasks (id, column_id, title, priority, progress, comment_count, completed_subtask_count, position)
     SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::int[], $6::int[], $7::int[], $8::int[])`,
    [
      tasks.map((t) => idFor(t.id)),
      tasks.map((t) => idFor(t.columnId)),
      tasks.map((t) => t.title),
      tasks.map((t) => t.priority),
      tasks.map((t) => t.progress),
      // comment_count tracks real comments, and the sample has none (its commentCount
      // values are placeholders from the design mockups)
      tasks.map(() => 0),
      tasks.map((t) => t.completedSubtaskCount),
      tasks.map((t) => t.position),
    ],
  )

  const links = tasks.flatMap((task) =>
    task.assignees.map((person, position) => ({ taskId: idFor(task.id), personId: idFor(person.id), position })),
  )
  await client.query(
    'INSERT INTO task_assignees (task_id, person_id, position) SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::int[])',
    [links.map((l) => l.taskId), links.map((l) => l.personId), links.map((l) => l.position)],
  )

  return boardId
}
