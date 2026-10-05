import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import type { Column as ColumnType, Task } from '../../shared/kanban.ts'
import AddTaskForm from './AddTaskForm'
import { PlusIcon } from './icons'
import SortableCard from './SortableCard'
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
}: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  // The whole column is a drop zone, so cards can be dropped into an empty column too.
  // type/taskIds are read by keyboard navigation (see keyboardCoordinates.ts)
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column', taskIds: column.taskIds },
  })
  const titleId = `column-title-${column.id}`

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
        {/* Only the shown cards are sortable: dnd-kit's items must match what's rendered.
            Where a dropped card lands is worked out against the full column in Board */}
        <SortableContext
          id={column.id}
          items={tasks.map((task) => task.id)}
          strategy={orientation === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} disabled={readOnly} onOpen={onOpenTask} search={search} />
          ))}
        </SortableContext>
        {filtering && tasks.length === 0 && <p className="column-empty">No matching tasks</p>}
      </div>
    </section>
  )
}

export default Column
