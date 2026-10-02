import type { Column as ColumnType, Task } from '../types/kanban'
import AddTaskForm from './AddTaskForm'
import Card from './Card'

interface ColumnProps {
  column: ColumnType
  tasks: Task[]
  onAddTask: (columnId: string, title: string) => void
}

function Column({ column, tasks, onAddTask }: ColumnProps) {
  return (
    <section className="column" aria-labelledby={`column-title-${column.id}`}>
      <header className="column-header">
        <h2 id={`column-title-${column.id}`}>{column.title}</h2>
        <span className="column-count">{tasks.length}</span>
      </header>

      <div className="column-tasks">
        {tasks.map((task) => (
          <Card key={task.id} task={task} />
        ))}
      </div>

      <AddTaskForm onAdd={(title) => onAddTask(column.id, title)} />
    </section>
  )
}

export default Column
