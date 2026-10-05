import { useState } from 'react'
import { PRIORITY_LABELS, type Board, type Task } from '../../shared/kanban.ts'
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

const MAX_VISIBLE_ASSIGNEES = 3

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
  const rows = board.columnOrder.flatMap((columnId, columnIndex) =>
    board.columns[columnId].taskIds
      .map((taskId, position) => ({ task: board.tasks[taskId], column: board.columns[columnId], columnIndex, position }))
      .filter(({ task }) => task && isVisible(task)),
  )
  const flip = sort.direction === 'ascending' ? 1 : -1
  const boardOrder = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    a.columnIndex - b.columnIndex || a.position - b.position
  rows.sort((a, b) => {
    if (sort.key === 'status') return flip * boardOrder(a, b)
    // Due date: tasks without one go last either way; ties keep board order
    const [da, db] = [a.task.dueDate, b.task.dueDate]
    if (!da || !db) return (da ? -1 : 0) + (db ? 1 : 0) || boardOrder(a, b)
    return flip * da.localeCompare(db) || boardOrder(a, b)
  })

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
      <table className="task-list">
        <caption className="visually-hidden">Tasks. Sort by status or due date with the column header buttons.</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            {sortHeader('status', 'Status')}
            <th scope="col">Priority</th>
            {sortHeader('due', 'Due date')}
            <th scope="col">Assignees</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, column }) => {
            const shown = task.assignees.slice(0, MAX_VISIBLE_ASSIGNEES)
            const more = task.assignees.length - shown.length
            return (
              // A click anywhere on the row opens the task; keyboard users use the title button
              <tr key={task.id} onClick={() => onOpenTask(task.id)}>
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
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="task-list-empty">
                No matching tasks
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default TaskList
