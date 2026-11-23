import { PRIORITIES, type Assignee, type Board, type Column, type Task } from '../../shared/kanban.ts'
import { initialsAvatar } from '../../shared/people.ts'

/** Ids of everything generated start with this, so they can never be mistaken for real ones */
export const DEMO_ID_PREFIX = 'demo-'

// Avatars are drawn locally (data URLs): thousands of cards must not mean thousands of requests
const PEOPLE: Assignee[] = ['Ana Petrova', 'Marko Ilievski', 'Sara Novak', 'David Chen', 'Lena Weber', 'Omar Haddad'].map(
  (name, i) => ({ id: `${DEMO_ID_PREFIX}person-${i + 1}`, name, avatarUrl: initialsAvatar(name) }),
)

const COLUMNS: Omit<Column, 'taskIds'>[] = [
  { id: `${DEMO_ID_PREFIX}todo`, title: 'To Do', status: 'todo' },
  { id: `${DEMO_ID_PREFIX}in-progress`, title: 'In Progress', status: 'in-progress' },
  { id: `${DEMO_ID_PREFIX}completed`, title: 'Completed', status: 'completed' },
]

const VERBS = ['Design', 'Review', 'Write', 'Test', 'Fix', 'Update', 'Plan', 'Ship', 'Measure', 'Refactor']
const THINGS = [
  'pricing page',
  'onboarding emails',
  'search results',
  'mobile menu',
  'invoice export',
  'login form',
  'dark theme',
  'release notes',
  'error alerts',
  'team settings',
  'API docs',
  'checkout flow',
]

/** mulberry32: a tiny seeded random generator, so the same seed always gives the same board */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** "YYYY-MM-DD" in local time, like the date input uses */
function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * A board of `count` generated tasks across To Do, In Progress and Completed, built in memory
 * for the performance demo. Nothing here is sent anywhere. Due dates are spread around `today`
 * (some overdue, some without one), so cards look like a real board's.
 */
export function generateDemoBoard(count: number, { seed = 1, today = new Date() } = {}): Board {
  const random = seededRandom(seed)
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]
  const tasks: Record<string, Task> = {}
  const taskIds: string[][] = COLUMNS.map(() => [])

  for (let i = 0; i < count; i++) {
    // Roughly 40% To Do, 35% In Progress, 25% Completed
    const roll = random()
    const columnIndex = roll < 0.4 ? 0 : roll < 0.75 ? 1 : 2
    const id = `${DEMO_ID_PREFIX}task-${i + 1}`

    const assignees: Assignee[] = []
    const assigneeCount = Math.floor(random() * 3) // 0 to 2
    while (assignees.length < assigneeCount) {
      const person = pick(PEOPLE)
      if (!assignees.includes(person)) assignees.push(person)
    }

    let dueDate: string | null = null
    if (random() < 0.7) {
      const due = new Date(today)
      due.setDate(due.getDate() + Math.floor(random() * 60) - 20) // 20 days ago to 39 days ahead
      dueDate = isoDate(due)
    }

    tasks[id] = {
      id,
      // Numbered, so every title is different (search and screen readers can tell them apart)
      title: `${pick(VERBS)} ${pick(THINGS)} #${i + 1}`,
      description: '',
      dueDate,
      priority: pick(PRIORITIES),
      // The Completed column means done, as on the real board
      progress: columnIndex === 2 ? 100 : columnIndex === 0 ? 0 : 10 * (1 + Math.floor(random() * 9)),
      assignees,
      commentCount: Math.floor(random() * 6),
      completedSubtaskCount: Math.floor(random() * 5),
    }
    taskIds[columnIndex].push(id)
  }

  return {
    id: `${DEMO_ID_PREFIX}board`,
    title: 'Performance demo',
    tasks,
    columns: Object.fromEntries(COLUMNS.map((column, i) => [column.id, { ...column, taskIds: taskIds[i] }])),
    columnOrder: COLUMNS.map((column) => column.id),
    people: PEOPLE,
  }
}
