export type TaskStatus = 'todo' | 'in-progress' | 'completed'

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
  tag: string
  /** Any CSS color value, e.g. '#7c5cff' */
  tagColor: string
  /** 0–100 */
  progress: number
  assignees: Assignee[]
}

export interface Column {
  id: string
  title: string
  status: TaskStatus
  /** Ordered top to bottom */
  taskIds: string[]
}

export interface Board {
  tasks: Record<string, Task>
  columns: Record<string, Column>
  /** Ordered left to right */
  columnOrder: string[]
}
