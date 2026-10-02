import { PRIORITY_LABELS, type Board, type TaskStatus } from '../types/kanban'

const STORAGE_KEY = 'kanban-board'
/** Bump when the saved shape changes, and migrate or discard older versions in loadBoard */
const STORAGE_VERSION = 1

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'completed']

/** The saved board, or null when there isn't a usable one (missing, corrupted, or storage blocked) */
export function loadBoard(): Board | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const saved: unknown = JSON.parse(raw)
    if (!isRecord(saved) || saved.version !== STORAGE_VERSION || !isBoard(saved.board)) {
      console.warn('Ignoring saved board: unexpected format')
      return null
    }
    return saved.board
  } catch (error) {
    // Invalid JSON, or localStorage itself unavailable (e.g. blocked by browser settings)
    console.warn('Ignoring saved board:', error)
    return null
  }
}

export function saveBoard(board: Board) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, board }))
  } catch (error) {
    // Storage full or blocked: keep working, the board just won't survive a reload
    console.warn('Could not save board:', error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isString = (value: unknown) => typeof value === 'string'
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)

/**
 * Checks everything the UI relies on, so a board that parses but is broken
 * (e.g. a column pointing at a missing task) falls back instead of crashing a render.
 */
function isBoard(value: unknown): value is Board {
  if (!isRecord(value) || !isString(value.title)) return false
  const { tasks, columns, columnOrder } = value
  if (!isRecord(tasks) || !isRecord(columns) || !Array.isArray(columnOrder)) return false

  const tasksValid = Object.entries(tasks).every(
    ([id, task]) =>
      isRecord(task) &&
      task.id === id &&
      isString(task.title) &&
      isString(task.priority) &&
      task.priority in PRIORITY_LABELS &&
      isNumber(task.progress) &&
      isNumber(task.commentCount) &&
      isNumber(task.completedSubtaskCount) &&
      Array.isArray(task.assignees) &&
      task.assignees.every(
        (person) =>
          isRecord(person) && isString(person.id) && isString(person.name) && isString(person.avatarUrl),
      ),
  )
  if (!tasksValid) return false

  const placedTaskIds = new Set<string>()
  const columnsValid = columnOrder.every((columnId) => {
    const column = isString(columnId) ? columns[columnId as string] : undefined
    return (
      isRecord(column) &&
      column.id === columnId &&
      isString(column.title) &&
      STATUSES.includes(column.status as TaskStatus) &&
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
