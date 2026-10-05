import type { ComponentPropsWithRef } from 'react'
import { PRIORITY_LABELS, type Task } from '../../shared/kanban.ts'
import DueDate from './DueDate'
import Highlight from './Highlight'
import { CheckCircleIcon, CommentIcon } from './icons'
import './Card.css'

/** The design shows four faces, then a "+N" chip */
const MAX_VISIBLE_ASSIGNEES = 4

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Extra article props (ref, style, drag attributes) let SortableCard make it draggable */
interface CardProps extends ComponentPropsWithRef<'article'> {
  task: Task
  /** Lowercased search text to highlight in the title */
  search?: string
}

function Card({ task, search = '', className, ...articleProps }: CardProps) {
  const visibleAssignees = task.assignees.slice(0, MAX_VISIBLE_ASSIGNEES)
  const hiddenCount = task.assignees.length - visibleAssignees.length
  const isDone = task.progress >= 100

  return (
    <article className={className ? `card ${className}` : 'card'} {...articleProps}>
      <div className="card-top">
        <span className="card-priority" data-priority={task.priority}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.dueDate && <DueDate date={task.dueDate} done={isDone} />}
      </div>

      <h3 className="card-title">
        <Highlight text={task.title} search={search} />
      </h3>

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
              <img
                src={assignee.avatarUrl}
                alt={assignee.name}
                title={assignee.name}
                draggable={false}
              />
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
