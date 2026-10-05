import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type pg from 'pg'
import type { Priority, TaskStatus } from '../../../shared/kanban.ts'
import { DEMO_EMAIL, DEMO_PASSWORD } from './account.ts'

// The live demo's starting point: a product team's sprint board with descriptions, due
// dates, assignees and a few comments. Due dates are relative to the reset day, so there's
// always something overdue and something due soon.

const people = {
  ana: { name: 'Ana Petrova', avatarUrl: 'https://i.pravatar.cc/64?img=5' },
  marko: { name: 'Marko Ilievski', avatarUrl: 'https://i.pravatar.cc/64?img=12' },
  sara: { name: 'Sara Novak', avatarUrl: 'https://i.pravatar.cc/64?img=32' },
  david: { name: 'David Chen', avatarUrl: 'https://i.pravatar.cc/64?img=53' },
  elena: { name: 'Elena Stojanova', avatarUrl: 'https://i.pravatar.cc/64?img=44' },
  luka: { name: 'Luka Horvat', avatarUrl: 'https://i.pravatar.cc/64?img=15' },
  mia: { name: 'Mia Jovanovska', avatarUrl: 'https://i.pravatar.cc/64?img=26' },
}
type PersonKey = keyof typeof people

interface DemoTask {
  title: string
  description: string
  priority: Priority
  progress: number
  /** Days from the reset day; null for no due date */
  dueInDays: number | null
  assignees: PersonKey[]
  subtasks: number
  /** Oldest first; minutesAgo is relative to the reset */
  comments?: { author: PersonKey; body: string; minutesAgo: number }[]
}

const columns: { title: string; status: TaskStatus; tasks: DemoTask[] }[] = [
  {
    title: 'To Do',
    status: 'todo',
    tasks: [
      {
        title: 'Usability test the new onboarding flow',
        description: 'Five sessions with trial users. Focus on the workspace setup step, where most people drop off.',
        priority: 'high-priority',
        progress: 0,
        dueInDays: 5,
        assignees: ['sara', 'elena'],
        subtasks: 0,
      },
      {
        title: 'Audit colour contrast on the marketing site',
        description: 'Check every page against WCAG AA in light and dark mode and list what fails.',
        priority: 'important',
        progress: 10,
        dueInDays: -2,
        assignees: ['mia'],
        subtasks: 1,
      },
      {
        title: 'Write release notes for v2.3',
        description: '',
        priority: 'ok',
        progress: 0,
        dueInDays: 9,
        assignees: ['luka'],
        subtasks: 0,
      },
    ],
  },
  {
    title: 'In Progress',
    status: 'in-progress',
    tasks: [
      {
        title: 'Redesign the pricing page',
        description: 'New comparison table, an annual/monthly toggle, and a clearer path to the team plan.',
        priority: 'high-priority',
        progress: 60,
        dueInDays: 3,
        assignees: ['ana', 'marko'],
        subtasks: 4,
        comments: [
          {
            author: 'marko',
            body: 'First pass of the comparison table is in Figma. Can someone check the copy on the annual/monthly toggle?',
            minutesAgo: 180,
          },
          {
            author: 'ana',
            body: "Looks great. Let's try the toggle with two customers before we build it.",
            minutesAgo: 45,
          },
        ],
      },
      {
        title: 'Set up error monitoring for the API',
        description: 'Alerts for 5xx spikes and slow queries, routed to the on-call channel.',
        priority: 'important',
        progress: 80,
        dueInDays: -1,
        assignees: ['luka', 'david'],
        subtasks: 6,
      },
      {
        title: 'Mobile navigation prototype',
        description: 'Bottom tab bar versus hamburger menu, as clickable prototypes for the next test round.',
        priority: 'ok',
        progress: 25,
        dueInDays: null,
        assignees: ['elena'],
        subtasks: 2,
      },
      {
        title: 'Move icons to a single SVG sprite',
        description: '',
        priority: 'meh',
        progress: 35,
        dueInDays: 12,
        assignees: ['david'],
        subtasks: 3,
      },
    ],
  },
  {
    title: 'Completed',
    status: 'completed',
    tasks: [
      {
        title: 'Summarise customer interviews',
        description: 'Twelve interviews, grouped into themes, with quotes for each.',
        priority: 'important',
        progress: 100,
        dueInDays: -6,
        assignees: ['sara', 'ana'],
        subtasks: 12,
        comments: [
          {
            author: 'sara',
            body: 'The summary deck is in the shared drive. The top three themes are onboarding, export and team permissions.',
            minutesAgo: 1500,
          },
        ],
      },
      {
        title: 'Design tokens for dark mode',
        description: '',
        priority: 'ok',
        progress: 100,
        dueInDays: null,
        assignees: ['mia'],
        subtasks: 5,
      },
      {
        title: 'Fix the login redirect loop in Safari',
        description: 'Safari dropped the session cookie on the redirect after logging in.',
        priority: 'high-priority',
        progress: 100,
        dueInDays: -9,
        assignees: ['david'],
        subtasks: 2,
      },
      {
        title: 'Tidy up the old style guide',
        description: '',
        priority: 'not-important',
        progress: 100,
        dueInDays: null,
        assignees: [],
        subtasks: 0,
      },
    ],
  },
]

/** "YYYY-MM-DD", n days from today (UTC, like the server) */
function dayFromToday(n: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

/**
 * Replaces everything on the board with the demo board and (re)creates the demo account
 * with its known password. Accounts other than the demo one are left alone.
 * Run it inside a transaction.
 */
export async function resetDemo(client: pg.PoolClient, { bcryptRounds = 12 } = {}): Promise<string> {
  // Every board, task, comment and person (including the people created for commenters)
  await client.query('TRUNCATE boards, people CASCADE')

  const boardId = randomUUID()
  await client.query('INSERT INTO boards (id, title) VALUES ($1, $2)', [boardId, 'DropDesign'])

  const personIds = Object.fromEntries(Object.keys(people).map((key) => [key, randomUUID()])) as Record<PersonKey, string>
  for (const [key, person] of Object.entries(people) as [PersonKey, (typeof people)[PersonKey]][]) {
    await client.query('INSERT INTO people (id, name, avatar_url) VALUES ($1, $2, $3)', [
      personIds[key],
      person.name,
      person.avatarUrl,
    ])
  }

  for (const [columnPosition, column] of columns.entries()) {
    const columnId = randomUUID()
    await client.query('INSERT INTO columns (id, board_id, title, status, position) VALUES ($1, $2, $3, $4, $5)', [
      columnId,
      boardId,
      column.title,
      column.status,
      columnPosition,
    ])
    for (const [position, task] of column.tasks.entries()) {
      const taskId = randomUUID()
      await client.query(
        `INSERT INTO tasks (id, column_id, title, description, priority, progress, due_date,
                            comment_count, completed_subtask_count, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          taskId,
          columnId,
          task.title,
          task.description,
          task.priority,
          task.progress,
          task.dueInDays === null ? null : dayFromToday(task.dueInDays),
          task.comments?.length ?? 0,
          task.subtasks,
          position,
        ],
      )
      for (const [assigneePosition, key] of task.assignees.entries()) {
        await client.query('INSERT INTO task_assignees (task_id, person_id, position) VALUES ($1, $2, $3)', [
          taskId,
          personIds[key],
          assigneePosition,
        ])
      }
      for (const comment of task.comments ?? []) {
        await client.query(
          `INSERT INTO comments (task_id, author_id, body, created_at)
           VALUES ($1, $2, $3, now() - make_interval(mins => $4))`,
          [taskId, personIds[comment.author], comment.body, comment.minutesAgo],
        )
      }
    }
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, bcryptRounds)
  await client.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [DEMO_EMAIL, passwordHash],
  )
  return boardId
}
