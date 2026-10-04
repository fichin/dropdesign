import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent } from 'react'
import type { Task } from '../../shared/kanban.ts'
import Card from './Card'

interface SortableCardProps {
  task: Task
  disabled?: boolean
  /** Click or Enter: open the task detail modal */
  onOpen: (taskId: string) => void
  /** Lowercased search text to highlight */
  search?: string
}

function SortableCard({ task, disabled = false, onOpen, search }: SortableCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging, active } = useSortable({
    id: task.id,
    disabled,
  })

  // Space picks the card up for dragging (Board's keyboard sensor); Enter opens it
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    listeners?.onKeyDown?.(event)
    if (event.key === 'Enter' && !active && !event.defaultPrevented) {
      event.preventDefault()
      onOpen(task.id)
    }
  }

  return (
    <Card
      ref={setNodeRef}
      task={task}
      search={search}
      // While dragging, the card left in the list becomes the "it will land here" slot;
      // the card under the pointer is a copy rendered in Board's DragOverlay
      className={isDragging ? 'card-placeholder' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-haspopup="dialog"
      // A click right after a drag is swallowed by dnd-kit, so this only fires for real clicks
      onClick={() => onOpen(task.id)}
      onKeyDown={handleKeyDown}
    />
  )
}

export default SortableCard
