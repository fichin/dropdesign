import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useMemo, useState } from 'react'
import type { Column as ColumnType, Task } from '../../shared/kanban.ts'
import AddTaskForm from './AddTaskForm'
import { PlusIcon } from './icons'
import SortableCard from './SortableCard'
import VirtualCards from './VirtualCards'
import './Column.css'

interface ColumnProps {
  column: ColumnType
  /** The tasks to show: all of them, or those matching the search and filters */
  tasks: Task[]
  /** Search or filters are active (so some tasks may be hidden) */
  filtering: boolean
  /** Lowercased search text to highlight in card titles */
  search: string
  /** A dragged card is over this column and would land here */
  isDropTarget: boolean
  /** Showing a cached copy: no dragging or adding */
  readOnly: boolean
  onAddTask: (columnId: string, title: string) => void
  onOpenTask: (taskId: string) => void
  /** Cards top to bottom (Grid, Column views) or left to right (Row view lanes) */
  orientation?: 'vertical' | 'horizontal'
  /** Render only the cards near the screen (a long column in the Column view; see VirtualCards) */
  virtualized?: boolean
  /** The card being dragged; only passed to virtualized columns, which must keep it in the page */
  activeTaskId?: string | null
}

function Column({
  column,
  tasks,
  filtering,
  search,
  isDropTarget,
  readOnly,
  onAddTask,
  onOpenTask,
  orientation = 'vertical',
  virtualized = false,
  activeTaskId = null,
}: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  // The whole column is a drop zone, so cards can be dropped into an empty column too.
  // type/taskIds are read by keyboard navigation (see keyboardCoordinates.ts)
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column', taskIds: column.taskIds },
  })
  const titleId = `column-title-${column.id}`
  // dnd-kit re-renders every card in the column whenever `items` is a new array, so keep the
  // same array until the ids or their order change (not, say, when one task's title is edited)
  const idsKey = tasks.map((task) => task.id).join('\n')
  const items = useMemo(() => (idsKey ? idsKey.split('\n') : []), [idsKey])

  return (
    <section
      ref={setNodeRef}
      className={isDropTarget ? 'column column-drop-target' : 'column'}
      data-status={column.status}
      aria-labelledby={titleId}
    >
      <header className="column-header">
        <h2 id={titleId} className="column-title">
          {column.title}{' '}
          <span className="column-count">
            ({filtering ? `${tasks.length} of ${column.taskIds.length}` : column.taskIds.length})
          </span>
        </h2>
        <button
          type="button"
          className="column-add-button"
          aria-label={`Add task to ${column.title}`}
          aria-expanded={isAdding && !readOnly}
          disabled={readOnly}
          title={readOnly ? "Can't add tasks while offline" : undefined}
          onClick={() => setIsAdding(true)}
        >
          <PlusIcon />
        </button>
      </header>

      <div className="column-tasks">
        {isAdding && !readOnly && (
          <AddTaskForm
            onAdd={(title) => onAddTask(column.id, title)}
            onClose={() => setIsAdding(false)}
          />
        )}
        {/* Only the shown cards are sortable. Where a dropped card lands is worked out against
            the full column in Board. A virtualized column keeps every shown card in items, so
            each card's index is its real position, though only some cards are rendered */}
        <SortableContext
          id={column.id}
          items={items}
          strategy={orientation === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}
        >
          {virtualized
            ? tasks.length > 0 && (
                <VirtualCards tasks={tasks} activeTaskId={activeTaskId} readOnly={readOnly} onOpenTask={onOpenTask} search={search} />
              )
            : tasks.map((task) => (
                <SortableCard key={task.id} task={task} disabled={readOnly} onOpen={onOpenTask} search={search} />
              ))}
        </SortableContext>
        {tasks.length === 0 && !isAdding && (
          // Still a drop zone: the message gives way as soon as a dragged card arrives
          <p className="column-empty">{filtering ? 'No matching tasks' : 'No tasks yet'}</p>
        )}
      </div>
    </section>
  )
}

/**
 * Board builds each column's task list afresh on every render, so `tasks` is compared item by
 * item and every other prop by identity: a column re-renders only when something it shows changed
 */
function sameColumnProps(prev: ColumnProps, next: ColumnProps) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof ColumnProps>
  return [...keys].every((key) =>
    key === 'tasks'
      ? prev.tasks.length === next.tasks.length && prev.tasks.every((task, i) => task === next.tasks[i])
      : Object.is(prev[key], next[key]),
  )
}

export default memo(Column, sameColumnProps)
