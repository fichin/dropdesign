import type { CSSProperties } from 'react'
import type { Task } from '../types/kanban'

interface CardProps {
  task: Task
}

function Card({ task }: CardProps) {
  return (
    <article className="card">
      {/* tagColor is exposed as a CSS variable so it can be used from your stylesheet */}
      <span
        className="card-tag"
        style={{ '--tag-color': task.tagColor } as CSSProperties}
      >
        {task.tag}
      </span>

      <h3 className="card-title">{task.title}</h3>

      <div className="card-progress">
        <progress value={task.progress} max={100} />
        <span>{task.progress}%</span>
      </div>

      <ul className="card-assignees">
        {task.assignees.map((assignee) => (
          <li key={assignee.id}>
            <img src={assignee.avatarUrl} alt={assignee.name} title={assignee.name} />
          </li>
        ))}
      </ul>
    </article>
  )
}

export default Card
