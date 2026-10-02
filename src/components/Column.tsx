import { useState } from 'react'
import type { Column as ColumnType, Task } from '../types/kanban'
import AddTaskForm from './AddTaskForm'
import Card from './Card'
import { PlusIcon } from './icons'
import './Column.css'

interface ColumnProps {
  column: ColumnType
  tasks: Task[]
  onAddTask: (columnId: string, title: string) => void
}

function Column({ column, tasks, onAddTask }: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const titleId = `column-title-${column.id}`

  return (
    <section className="column" data-status={column.status} aria-labelledby={titleId}>
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
        {tasks.map((task) => (
          <Card key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}

export default Column
