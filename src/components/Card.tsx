import { PRIORITY_LABELS, type Task } from '../types/kanban'
import { CheckCircleIcon, CommentIcon } from './icons'
import './Card.css'

/** The design shows four faces, then a "+N" chip */
const MAX_VISIBLE_ASSIGNEES = 4

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

interface CardProps {
  task: Task
}

function Card({ task }: CardProps) {
  const visibleAssignees = task.assignees.slice(0, MAX_VISIBLE_ASSIGNEES)
  const hiddenCount = task.assignees.length - visibleAssignees.length
  const isDone = task.progress >= 100

  return (
    <article className="card">
      <span className="card-priority" data-priority={task.priority}>
        {PRIORITY_LABELS[task.priority]}
      </span>

      <h3 className="card-title">{task.title}</h3>

      <div className="card-progress">
        <div className="card-progress-labels">
          <span>Progress</span>
          <span className="card-progress-value">{isDone ? 'Done' : `${task.progress}%`}</span>
        </div>
        <div
          className="card-progress-track"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={task.progress}
        >
          <div className="card-progress-fill" style={{ width: `${task.progress}%` }} />
        </div>
      </div>

      <footer className="card-footer">
        <ul className="card-assignees">
          {visibleAssignees.map((assignee) => (
            <li key={assignee.id}>
              <img src={assignee.avatarUrl} alt={assignee.name} title={assignee.name} />
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="card-assignees-more" aria-label={`${hiddenCount} more assignees`}>
              +{hiddenCount}
            </li>
          )}
        </ul>

        <div className="card-stats">
          <span className="card-stat" title="Comments">
            <CommentIcon />
            <span className="visually-hidden">Comments: </span>
            {compactNumber.format(task.commentCount)}
          </span>
          <span className="card-stat" title="Completed subtasks">
            <CheckCircleIcon />
            <span className="visually-hidden">Completed subtasks: </span>
            {compactNumber.format(task.completedSubtaskCount)}
          </span>
        </div>
      </footer>
    </article>
  )
}

export default Card
