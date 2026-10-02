import { PRIORITIES, TASK_STATUSES, type Board, type Comment } from '../../shared/kanban.ts'

// A read-only copy of the last board the server confirmed. The server is the source
// of truth; this only lets the board appear instantly on load, and be viewed offline.
const STORAGE_KEY = 'kanban-board'
/**
 * Bump when the saved shape changes; older copies are ignored (the server has the real
 * board). v1: pre-backend local board. v2: no task descriptions or people list.
 */
const STORAGE_VERSION = 3

/** The cached board, or null when there isn't a usable one (missing, outdated, corrupted, or storage blocked) */
export function loadCachedBoard(): Board | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const saved: unknown = JSON.parse(raw)
    if (!isRecord(saved) || saved.version !== STORAGE_VERSION || !isBoard(saved.board)) {
      console.warn('Ignoring cached board: unexpected format')
      return null
    }
    return saved.board
  } catch (error) {
    // Invalid JSON, or localStorage itself unavailable (e.g. blocked by browser settings)
    console.warn('Ignoring cached board:', error)
    return null
  }
}

export function saveCachedBoard(board: Board) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, board }))
  } catch (error) {
    // Storage full or blocked: everything still works, there's just no offline copy
    console.warn('Could not cache board:', error)
  }
}

// Each task's comments are cached separately (they're loaded per task, not with the board),
// so they can still be read offline
const COMMENTS_KEY_PREFIX = 'kanban-comments:'

export function loadCachedComments(taskId: string): Comment[] | null {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY_PREFIX + taskId)
    if (raw === null) return null
    const saved: unknown = JSON.parse(raw)
    const valid =
      Array.isArray(saved) &&
      saved.every(
        (c) =>
          isRecord(c) &&
          isString(c.id) &&
          c.taskId === taskId &&
          isString(c.body) &&
          isString(c.createdAt) &&
          isPerson(c.author) &&
          (c.authorUserId === null || isString(c.authorUserId)),
      )
    return valid ? (saved as Comment[]) : null
  } catch {
    return null
  }
}

export function saveCachedComments(taskId: string, comments: Comment[]) {
  try {
    localStorage.setItem(COMMENTS_KEY_PREFIX + taskId, JSON.stringify(comments))
  } catch {
    // Storage full or blocked: comments just won't be readable offline
  }
}

/** On sign-out: the copy shouldn't outlive the session that was allowed to see it */
export function clearCachedBoard() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(COMMENTS_KEY_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Storage blocked: nothing was cached either
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isString = (value: unknown) => typeof value === 'string'
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isPerson = (value: unknown) =>
  isRecord(value) && isString(value.id) && isString(value.name) && isString(value.avatarUrl)

/**
 * Checks everything the UI relies on, so a board that parses but is broken
 * (e.g. a column pointing at a missing task) falls back instead of crashing a render.
 */
function isBoard(value: unknown): value is Board {
  if (!isRecord(value) || !isString(value.id) || !isString(value.title)) return false
  const { tasks, columns, columnOrder, people } = value
  if (!isRecord(tasks) || !isRecord(columns) || !Array.isArray(columnOrder)) return false
  if (!Array.isArray(people) || !people.every(isPerson)) return false

  const tasksValid = Object.entries(tasks).every(
    ([id, task]) =>
      isRecord(task) &&
      task.id === id &&
      isString(task.title) &&
      isString(task.description) &&
      PRIORITIES.includes(task.priority as (typeof PRIORITIES)[number]) &&
      isNumber(task.progress) &&
      isNumber(task.commentCount) &&
      isNumber(task.completedSubtaskCount) &&
      Array.isArray(task.assignees) &&
      task.assignees.every(isPerson),
  )
  if (!tasksValid) return false

  const placedTaskIds = new Set<string>()
  const columnsValid = columnOrder.every((columnId) => {
    const column = isString(columnId) ? columns[columnId as string] : undefined
    return (
      isRecord(column) &&
      column.id === columnId &&
      isString(column.title) &&
      TASK_STATUSES.includes(column.status as (typeof TASK_STATUSES)[number]) &&
      Array.isArray(column.taskIds) &&
      column.taskIds.every((taskId) => {
        // Each task must exist and sit in exactly one column
        if (!isString(taskId) || !(taskId in tasks) || placedTaskIds.has(taskId)) return false
        placedTaskIds.add(taskId)
        return true
      })
    )
  })

  return columnsValid && Object.keys(columns).length === columnOrder.length
}
