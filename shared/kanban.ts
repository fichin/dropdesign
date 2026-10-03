// Shared by the frontend (src/) and the backend (backend/). The backend's database
// CHECK constraints list the same values: keep backend/migrations in sync.

export const TASK_STATUSES = ['todo', 'in-progress', 'completed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const PRIORITIES = ['high-priority', 'important', 'ok', 'meh', 'not-important'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  'high-priority': 'High Priority',
  important: 'Important',
  ok: 'OK',
  meh: 'Meh',
  'not-important': 'Not that important',
}

export interface Assignee {
  id: string
  name: string
  avatarUrl: string
}

/**
 * A task's status isn't stored on the task: it's whichever column lists the
 * task's id. That way moving a task (later, via drag-and-drop) is a single
 * update to the columns' taskIds and the two can never disagree.
 */
export interface Task {
  id: string
  title: string
  /** Longer text shown in the task detail modal; '' when there is none */
  description: string
  /**
   * Calendar date as "YYYY-MM-DD", or null. Deliberately not a Date/timestamp: a due date
   * has no time, and converting it would shift it by a day in some timezones
   */
  dueDate: string | null
  /** Colors come from the stylesheet, keyed by priority */
  priority: Priority
  /** 0–100 */
  progress: number
  assignees: Assignee[]
  commentCount: number
  completedSubtaskCount: number
}

export interface Comment {
  id: string
  taskId: string
  body: string
  /** ISO timestamp */
  createdAt: string
  author: Assignee
  /** The account that wrote it (to tell "your" comments apart); null if that account is gone */
  authorUserId: string | null
}

export interface Column {
  id: string
  title: string
  status: TaskStatus
  /** Ordered top to bottom */
  taskIds: string[]
}

export interface Board {
  id: string
  title: string
  tasks: Record<string, Task>
  columns: Record<string, Column>
  /** Ordered left to right */
  columnOrder: string[]
  /** Everyone who can be assigned to tasks, by name */
  people: Assignee[]
}
