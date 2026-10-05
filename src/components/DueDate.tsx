import { formatDueDate, formatDueDateLong, isOverdue } from '../utils/dates'
import { CalendarIcon } from './icons'
import './Card.css'

/**
 * Calendar icon + "Oct 15"; rose when overdue (past, and the task isn't finished).
 * Used on cards and in the List view.
 */
function DueDate({ date, done }: { date: string; done: boolean }) {
  const overdue = !done && isOverdue(date)
  return (
    <span
      className={overdue ? 'card-due card-due-overdue' : 'card-due'}
      title={`Due ${formatDueDateLong(date)}${overdue ? ' (overdue)' : ''}`}
    >
      <CalendarIcon />
      <span className="visually-hidden">Due </span>
      <time dateTime={date}>{formatDueDate(date)}</time>
      {overdue && <span className="visually-hidden">, overdue</span>}
    </span>
  )
}

export default DueDate
