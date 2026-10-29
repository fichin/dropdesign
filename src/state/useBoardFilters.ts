import { useCallback, useMemo, useState } from 'react'
import type { Board, Priority, Task } from '../../shared/kanban.ts'
import { isOverdue } from '../utils/dates'

/**
 * Search text and filters for the board. Purely local view state: it never changes the
 * board data or talks to the server, it only decides which tasks are rendered.
 *
 * Within one filter, any selected option matches (High OR Important); across filters,
 * and together with the search text, every condition must match (AND).
 */
export function useBoardFilters(board: Board | null) {
  const [query, setQuery] = useState('')
  const [priorities, setPriorities] = useState<ReadonlySet<Priority>>(new Set())
  const [assigneeIds, setAssigneeIds] = useState<ReadonlySet<string>>(new Set())
  const [overdueOnly, setOverdueOnly] = useState(false)

  const search = query.trim().toLowerCase()

  const matches = useCallback(
    (task: Task) => {
      if (search && !task.title.toLowerCase().includes(search) && !task.description.toLowerCase().includes(search)) {
        return false
      }
      if (priorities.size && !priorities.has(task.priority)) return false
      if (assigneeIds.size && !task.assignees.some((person) => assigneeIds.has(person.id))) return false
      // Same rule as the card: past due and not finished
      if (overdueOnly && !(task.dueDate && task.progress < 100 && isOverdue(task.dueDate))) return false
      return true
    },
    [search, priorities, assigneeIds, overdueOnly],
  )

  /** Filter options chosen (the search text is shown in its own box, so it isn't counted) */
  const activeFilterCount = priorities.size + assigneeIds.size + (overdueOnly ? 1 : 0)
  const isFiltering = search !== '' || activeFilterCount > 0

  const counts = useMemo(() => {
    const tasks = board ? Object.values(board.tasks) : []
    return { visible: tasks.filter(matches).length, total: tasks.length }
  }, [board, matches])

  const toggle = <T,>(set: ReadonlySet<T>, value: T) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  // Stable, so callbacks built on it (BoardScreen's onAddTask) don't change on every render
  const clear = useCallback(() => {
    setQuery('')
    setPriorities(new Set())
    setAssigneeIds(new Set())
    setOverdueOnly(false)
  }, [])

  return {
    query,
    setQuery,
    /** Lowercased, trimmed search text, for highlighting matches */
    search,
    priorities,
    togglePriority: (priority: Priority) => setPriorities((current) => toggle(current, priority)),
    assigneeIds,
    toggleAssignee: (personId: string) => setAssigneeIds((current) => toggle(current, personId)),
    overdueOnly,
    setOverdueOnly,
    matches,
    activeFilterCount,
    isFiltering,
    counts,
    /** Search and every filter, back to showing all tasks */
    clear,
  }
}

export type BoardFilters = ReturnType<typeof useBoardFilters>
