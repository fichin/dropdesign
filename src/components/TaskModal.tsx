import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { PRIORITIES, PRIORITY_LABELS, type Assignee, type Column, type Priority, type Task } from '../../shared/kanban.ts'
import type { User } from '../api/client'
import type { TaskChanges } from '../state/boardReducer'
import type { BoardSync } from '../state/useBoardSync'
import { isOverdue } from '../utils/dates'
import { CheckCircleIcon } from './icons'
import TaskComments from './TaskComments'
import './TaskModal.css'

const OFFLINE_HINT = "Can't edit while offline"

interface TaskModalProps {
  task: Task
  column: Column
  /** Every column, in board order, for the Status control */
  columns: Column[]
  /** Everyone who can be assigned */
  people: Assignee[]
  /** Showing a cached copy: details are visible but can't be changed */
  readOnly: boolean
  onUpdate: (changes: TaskChanges) => void
  /** Status changed: move the task to the top of that column */
  onMove: (columnId: string) => void
  onDelete: () => void
  onClose: () => void
  /** The signed-in user, for "your" comments (unknown while offline) */
  currentUser?: User
  comments: Pick<BoardSync, 'loadComments' | 'addComment' | 'deleteComment'>
  /** Rendered inside the dialog (e.g. save-error messages, which would otherwise sit behind it) */
  children?: ReactNode
}

/**
 * Task details and editing, in a native <dialog>: it keeps focus inside, closes on
 * Escape, blocks the page behind it, and returns focus to the card when closed.
 * Changes go through the same optimistic update + rollback path as the rest of the board.
 */
function TaskModal({
  task,
  column,
  columns,
  people,
  readOnly,
  onUpdate,
  onMove,
  onDelete,
  onClose,
  currentUser,
  comments,
  children,
}: TaskModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Text being typed; null when the field isn't being edited (then the task's value shows,
  // so a rolled-back change is visible straight away)
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null)
  // What the date input holds while it's being edited (it can be incomplete, e.g. while
  // typing a year it passes through 0002, 0020, 0202 before 2026)
  const [dueDateDraft, setDueDateDraft] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus()
  }, [confirmingDelete])

  function saveTitle() {
    if (titleDraft === null) return
    const title = titleDraft.trim()
    // An empty title isn't allowed: put the old one back
    if (title && title !== task.title) onUpdate({ title })
    setTitleDraft(null)
  }

  function saveDescription() {
    if (descriptionDraft === null) return
    if (descriptionDraft !== task.description) onUpdate({ description: descriptionDraft })
    setDescriptionDraft(null)
  }

  /** A whole date with a sensible year: save it straight away (picking from the calendar lands here) */
  function changeDueDate(value: string) {
    setDueDateDraft(value)
    const complete = /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900
    if (complete && value !== task.dueDate) onUpdate({ dueDate: value })
  }

  /** Leaving the field: an emptied field clears the date; anything incomplete reverts */
  function commitDueDate() {
    if (dueDateDraft === null) return
    if (dueDateDraft === '' && task.dueDate !== null) onUpdate({ dueDate: null })
    setDueDateDraft(null)
  }

  /** X, Escape, or a click outside: keep anything typed, then close */
  function close() {
    saveTitle()
    saveDescription()
    commitDueDate()
    onClose()
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    // The dialog element itself only receives clicks on its backdrop; the content fills the rest
    if (event.target === dialogRef.current) close()
  }

  const unassigned = people.filter((person) => !task.assignees.some((a) => a.id === person.id))
  const editDisabled = readOnly ? { disabled: true, title: OFFLINE_HINT } : {}

  return (
    <dialog
      ref={dialogRef}
      className="task-modal"
      aria-label={`Task: ${task.title}`}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={handleBackdropClick}
    >
      <div className="task-modal-content" data-status={column.status}>
        <header className="task-modal-header">
          <span className="task-modal-column">
            <span className="task-modal-dot" aria-hidden="true" />
            {column.title}
          </span>
          <button type="button" className="task-modal-close" aria-label="Close" onClick={close} autoFocus>
            ×
          </button>
        </header>

        {readOnly && (
          <p className="task-modal-offline" role="status">
            You're offline, so this task can be viewed but not edited.
          </p>
        )}

        <label className="visually-hidden" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          className="task-modal-title"
          value={titleDraft ?? task.title}
          maxLength={500}
          readOnly={readOnly}
          title={readOnly ? OFFLINE_HINT : undefined}
          onFocus={() => !readOnly && setTitleDraft(task.title)}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />

        <div className="task-modal-grid">
          <section className="task-modal-section">
            <label className="task-modal-label" htmlFor="task-status">
              Status
            </label>
            <select
              id="task-status"
              className="task-modal-select"
              value={column.id}
              onChange={(event) => onMove(event.target.value)}
              {...editDisabled}
            >
              {columns.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </section>

          <section className="task-modal-section">
            <label className="task-modal-label" htmlFor="task-priority">
              Priority
            </label>
            <select
              id="task-priority"
              className="task-modal-select"
              data-priority={task.priority}
              value={task.priority}
              onChange={(event) => onUpdate({ priority: event.target.value as Priority })}
              {...editDisabled}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </section>

          <section className="task-modal-section">
            <span className="task-modal-label">Progress</span>
            <span className="task-modal-progress">
              <span className="task-modal-progress-track">
                <span className="task-modal-progress-fill" style={{ width: `${task.progress}%` }} />
              </span>
              {task.progress >= 100 ? 'Done' : `${task.progress}%`}
            </span>
          </section>
        </div>

        <section className="task-modal-section">
          <label className="task-modal-label" htmlFor="task-description">
            Description
          </label>
          <textarea
            id="task-description"
            className="task-modal-description"
            rows={5}
            maxLength={5000}
            placeholder={readOnly ? 'No description' : 'Add a more detailed description…'}
            value={descriptionDraft ?? task.description}
            readOnly={readOnly}
            title={readOnly ? OFFLINE_HINT : undefined}
            onFocus={() => !readOnly && setDescriptionDraft(task.description)}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={saveDescription}
          />
        </section>

        <section className="task-modal-section">
          <h3 className="task-modal-label">Assignees</h3>
          {task.assignees.length === 0 && <p className="task-modal-empty">Nobody is assigned yet.</p>}
          <ul className="task-modal-assignees">
            {task.assignees.map((person) => (
              <li key={person.id} className="task-modal-assignee">
                <img src={person.avatarUrl} alt="" />
                <span>{person.name}</span>
                <button
                  type="button"
                  className="task-modal-remove"
                  aria-label={`Remove ${person.name}`}
                  onClick={() => onUpdate({ assignees: task.assignees.filter((a) => a.id !== person.id) })}
                  {...editDisabled}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {unassigned.length > 0 && (
            <select
              className="task-modal-select task-modal-add-person"
              aria-label="Add a person"
              value=""
              onChange={(event) => {
                const person = people.find((p) => p.id === event.target.value)
                if (person) onUpdate({ assignees: [...task.assignees, person] })
              }}
              {...editDisabled}
            >
              <option value="" disabled>
                + Add a person…
              </option>
              {unassigned.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          )}
        </section>

        <div className="task-modal-grid">
          <section className="task-modal-section">
            <label className="task-modal-label" htmlFor="task-due-date">
              Due date
              {task.dueDate && task.progress < 100 && isOverdue(task.dueDate) && (
                <span className="task-modal-overdue">Overdue</span>
              )}
            </label>
            <div className="task-modal-due">
              <input
                id="task-due-date"
                type="date"
                className="task-modal-select task-modal-date"
                min="1900-01-01"
                max="9999-12-31"
                value={dueDateDraft ?? task.dueDate ?? ''}
                onChange={(event) => changeDueDate(event.target.value)}
                onBlur={commitDueDate}
                {...editDisabled}
              />
              {task.dueDate && (
                <button
                  type="button"
                  className="task-modal-clear-date"
                  aria-label="Clear due date"
                  onClick={() => {
                    setDueDateDraft(null)
                    onUpdate({ dueDate: null })
                  }}
                  {...editDisabled}
                >
                  Clear
                </button>
              )}
            </div>
          </section>
          <p className="task-modal-subtasks">
            <CheckCircleIcon /> {task.completedSubtaskCount} completed subtasks
          </p>
        </div>

        <TaskComments
          taskId={task.id}
          commentCount={task.commentCount}
          currentUser={currentUser}
          readOnly={readOnly}
          sync={comments}
        />

        <footer className="task-modal-footer">
          {confirmingDelete ? (
            <div className="task-modal-confirm" role="alertdialog" aria-labelledby="delete-question">
              <p id="delete-question">Delete this task? This can't be undone.</p>
              <div className="task-modal-confirm-actions">
                <button ref={cancelDeleteRef} type="button" className="button-secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => {
                    onDelete()
                    onClose()
                  }}
                >
                  Delete task
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="task-modal-delete"
              onClick={() => setConfirmingDelete(true)}
              {...editDisabled}
              // The shared demo account can't delete (the server refuses too)
              {...(currentUser?.demo && !readOnly && { disabled: true, title: "The demo account can't delete tasks" })}
            >
              Delete task
            </button>
          )}
        </footer>
      </div>
      {children}
    </dialog>
  )
}

export default TaskModal
