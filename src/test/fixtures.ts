import type { Assignee, Board, Task } from '../../shared/kanban.ts'

export const ana: Assignee = { id: 'u1', name: 'Ana Petrova', avatarUrl: 'ana.png' }
export const marko: Assignee = { id: 'u2', name: 'Marko Ilievski', avatarUrl: 'marko.png' }
export const sara: Assignee = { id: 'u3', name: 'Sara Novak', avatarUrl: 'sara.png' }

export function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    dueDate: null,
    priority: 'ok',
    progress: 0,
    assignees: [],
    commentCount: 0,
    completedSubtaskCount: 0,
    ...overrides,
  }
}

/**
 * Three columns: todo [a, b, c], in-progress [d], completed [e].
 * Small and fixed, so tests don't depend on the demo data.
 */
export function makeBoard(tasks: Record<string, Partial<Task>> = {}): Board {
  const all = Object.fromEntries(
    ['a', 'b', 'c', 'd', 'e'].map((id) => [id, makeTask(id, tasks[id])]),
  )
  return {
    id: 'board',
    title: 'DropDesign',
    tasks: all,
    columns: {
      todo: { id: 'todo', title: 'To Do', status: 'todo', taskIds: ['a', 'b', 'c'] },
      doing: { id: 'doing', title: 'In Progress', status: 'in-progress', taskIds: ['d'] },
      done: { id: 'done', title: 'Completed', status: 'completed', taskIds: ['e'] },
    },
    columnOrder: ['todo', 'doing', 'done'],
    people: [ana, marko, sara],
  }
}
