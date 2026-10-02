import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import type { Column as ColumnType, Task } from '../types/kanban'
import AddTaskForm from './AddTaskForm'
import { PlusIcon } from './icons'
import SortableCard from './SortableCard'
import './Column.css'

interface ColumnProps {
  column: ColumnType
  tasks: Task[]
  /** A dragged card is over this column and would land here */
  isDropTarget: boolean
  onAddTask: (columnId: string, title: string) => void
}

function Column({ column, tasks, isDropTarget, onAddTask }: ColumnProps) {
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
          {column.title} <span className="column-count">({tasks.length})</span>
        </h2>
        <button
          type="button"
          className="column-add-button"
          aria-label={`Add task to ${column.title}`}
          aria-expanded={isAdding}
          onClick={() => setIsAdding(true)}
        >
          <PlusIcon />
        </button>
      </header>

      <div className="column-tasks">
        {isAdding && (
          <AddTaskForm
            onAdd={(title) => onAddTask(column.id, title)}
            onClose={() => setIsAdding(false)}
          />
        )}
        <SortableContext id={column.id} items={column.taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </section>
  )
}

export default Column
