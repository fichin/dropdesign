import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState, type ComponentPropsWithRef } from 'react'
import { PRIORITY_LABELS, type Board, type Column, type Task } from '../../shared/kanban.ts'
import DueDate from './DueDate'
import Highlight from './Highlight'
import './TaskList.css'

type SortKey = 'status' | 'due'
type SortDirection = 'ascending' | 'descending'

interface TaskListProps {
  board: Board
  /** Search/filters: only tasks this returns true for are listed */
  isVisible: (task: Task) => boolean
  /** Lowercased search text to highlight in titles */
  search: string
  onOpenTask: (taskId: string) => void
}

interface ListRow {
  task: Task
  column: Column
  columnIndex: number
  position: number
}

const MAX_VISIBLE_ASSIGNEES = 3

/**
 * Boards with more tasks than this render only the rows near the screen (see VirtualRows):
 * the same budget as the board views, 100 per column. It counts every task on the board,
 * not just the ones matching the filters, so typing a search never switches modes.
 * Smaller boards render every row, exactly as before.
 */
export const LIST_VIRTUALIZATION_THRESHOLD = 300

/**
 * List view: every task as a table row. Sortable by status (board order) and due date;
 * status changes happen in the task modal, which a row opens.
 */
function TaskList({ board, isVisible, search, onOpenTask }: TaskListProps) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'status',
    direction: 'ascending',
  })

  // Board order: columns left to right, then top to bottom within each
  const rows: ListRow[] = board.columnOrder.flatMap((columnId, columnIndex) =>
    board.columns[columnId].taskIds
      .map((taskId, position) => ({ task: board.tasks[taskId], column: board.columns[columnId], columnIndex, position }))
      .filter(({ task }) => task && isVisible(task)),
  )
  const flip = sort.direction === 'ascending' ? 1 : -1
  const boardOrder = (a: ListRow, b: ListRow) => a.columnIndex - b.columnIndex || a.position - b.position
  rows.sort((a, b) => {
    if (sort.key === 'status') return flip * boardOrder(a, b)
    // Due date: tasks without one go last either way; ties keep board order
    const [da, db] = [a.task.dueDate, b.task.dueDate]
    if (!da || !db) return (da ? -1 : 0) + (db ? 1 : 0) || boardOrder(a, b)
    return flip * da.localeCompare(db) || boardOrder(a, b)
  })
  const virtualized = Object.keys(board.tasks).length > LIST_VIRTUALIZATION_THRESHOLD && rows.length > 0

  function sortBy(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' },
    )
  }

  const sortHeader = (key: SortKey, label: string) => {
    const active = sort.key === key
    return (
      <th scope="col" aria-sort={active ? sort.direction : 'none'}>
        <button type="button" className="task-list-sort" onClick={() => sortBy(key)}>
          {label}
          <span className={active ? 'task-list-sort-icon task-list-sort-active' : 'task-list-sort-icon'} aria-hidden="true">
            {active ? (sort.direction === 'ascending' ? '↑' : '↓') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="task-list-wrap">
      <table
        className={virtualized ? 'task-list task-list-virtual' : 'task-list'}
        // Only some rows are in the page, so screen readers are told the full count (+1: the header row)
        aria-rowcount={virtualized ? rows.length + 1 : undefined}
      >
        <caption className="visually-hidden">Tasks. Sort by status or due date with the column header buttons.</caption>
        <thead>
          <tr aria-rowindex={virtualized ? 1 : undefined}>
            <th scope="col">Title</th>
            {sortHeader('status', 'Status')}
            <th scope="col">Priority</th>
            {sortHeader('due', 'Due date')}
            <th scope="col">Assignees</th>
          </tr>
        </thead>
        {virtualized ? (
          <VirtualRows rows={rows} search={search} onOpenTask={onOpenTask} />
        ) : (
          <tbody>
            {rows.map((row) => (
              <TaskRow key={row.task.id} row={row} search={search} onOpenTask={onOpenTask} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="task-list-empty">
                  {Object.keys(board.tasks).length === 0 ? 'No tasks yet' : 'No matching tasks'}
                </td>
              </tr>
            )}
          </tbody>
        )}
      </table>
    </div>
  )
}

/** Height of a row before it has been measured: one line of text next to the 28px avatars */
const ESTIMATED_ROW_HEIGHT = 57

/**
 * The table body for long lists: only the rows on screen (plus a few either side) are in the
 * page, and spacer rows of the same height stand in for the rest, so the page is as tall as
 * the whole table and the scrollbar behaves as usual. The page itself scrolls, as for short lists.
 */
function VirtualRows({ rows, search, onOpenTask }: { rows: ListRow[]; search: string; onOpenTask: (taskId: string) => void }) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  // Where the table body starts on the page: the virtualizer works in page coordinates
  const [scrollMargin, setScrollMargin] = useState(0)
  // The row that last had focus stays in the page even when scrolled away, so keyboard users
  // don't lose their place, and closing the task modal can hand focus back to its title button
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null)
  const focusedIndex = focusedTaskId === null ? -1 : rows.findIndex((row) => row.task.id === focusedTaskId)

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => setScrollMargin(body.getBoundingClientRect().top + window.scrollY)
    measure()
    // Anything above the table changing height (a status banner, the filter bar wrapping)
    // moves it down the page, and every such change resizes the body
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(document.body)
    return () => observer?.disconnect()
  }, [])

  const getItemKey = useCallback((index: number) => rows[index].task.id, [rows])
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range)
      if (focusedIndex === -1 || indexes.includes(focusedIndex)) return indexes
      return [...indexes, focusedIndex].sort((a, b) => a - b)
    },
    [focusedIndex],
  )
  // The rule is about the React Compiler (not used here) memoizing a component that holds the
  // virtualizer's functions; the only one passed on, measureElement, goes to TaskRow, which isn't memoized
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
    scrollMargin,
    getItemKey,
    rangeExtractor,
  })

  // Rendered rows in order, with a spacer row wherever rows are left out (before the first,
  // between the focused row and the rest, after the last). Positions are relative to the body
  const content = []
  let end = 0
  for (const item of virtualizer.getVirtualItems()) {
    const start = item.start - scrollMargin
    if (start > end) content.push(<SpacerRow key={`gap-${item.index}`} height={start - end} />)
    content.push(
      <TaskRow
        key={item.key}
        ref={virtualizer.measureElement}
        data-index={item.index}
        // +2: row 1 is the header row
        aria-rowindex={item.index + 2}
        row={rows[item.index]}
        search={search}
        onOpenTask={onOpenTask}
      />,
    )
    end = item.end - scrollMargin
  }
  const totalHeight = virtualizer.getTotalSize()
  if (totalHeight > end) content.push(<SpacerRow key="gap-end" height={totalHeight - end} />)

  return (
    <tbody
      ref={bodyRef}
      onFocus={(event) => {
        const index = Number((event.target as HTMLElement).closest('tr')?.dataset.index)
        if (Number.isInteger(index)) setFocusedTaskId(rows[index].task.id)
      }}
    >
      {content}
    </tbody>
  )
}

/** Stands in for rows that aren't rendered. Hidden from screen readers, which get aria-rowcount instead */
function SpacerRow({ height }: { height: number }) {
  return (
    <tr className="task-list-spacer" aria-hidden="true">
      <td colSpan={5} style={{ height }} />
    </tr>
  )
}

interface TaskRowProps extends ComponentPropsWithRef<'tr'> {
  row: ListRow
  search: string
  onOpenTask: (taskId: string) => void
}

/** One task. The extra row props (ref, data-index, aria-rowindex) are only passed for long lists */
function TaskRow({ row: { task, column }, search, onOpenTask, ...rowProps }: TaskRowProps) {
  const shown = task.assignees.slice(0, MAX_VISIBLE_ASSIGNEES)
  const more = task.assignees.length - shown.length
  return (
    // A click anywhere on the row opens the task; keyboard users use the title button
    <tr {...rowProps} onClick={() => onOpenTask(task.id)}>
      <th scope="row">
        <button type="button" className="task-list-title" aria-haspopup="dialog" onClick={(event) => {
          event.stopPropagation()
          onOpenTask(task.id)
        }}>
          <Highlight text={task.title} search={search} />
        </button>
      </th>
      <td>
        <span className="task-list-status" data-status={column.status}>
          {column.title}
        </span>
      </td>
      <td>
        <span className="card-priority" data-priority={task.priority}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </td>
      <td>
        {task.dueDate ? (
          <DueDate date={task.dueDate} done={task.progress >= 100} />
        ) : (
          <span className="task-list-none">
            <span aria-hidden="true">—</span>
            <span className="visually-hidden">No due date</span>
          </span>
        )}
      </td>
      <td>
        {task.assignees.length ? (
          <ul className="task-list-assignees" aria-label={task.assignees.map((person) => person.name).join(', ')}>
            {shown.map((person) => (
              <li key={person.id}>
                <img src={person.avatarUrl} alt="" title={person.name} />
              </li>
            ))}
            {more > 0 && (
              <li className="task-list-more" aria-hidden="true">
                +{more}
              </li>
            )}
          </ul>
        ) : (
          <span className="task-list-none">Unassigned</span>
        )}
      </td>
    </tr>
  )
}

export default TaskList
