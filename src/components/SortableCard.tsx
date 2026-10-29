import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useCallback, useMemo, type KeyboardEvent } from 'react'
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
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      listeners?.onKeyDown?.(event)
      if (event.key === 'Enter' && !active && !event.defaultPrevented) {
        event.preventDefault()
        onOpen(task.id)
      }
    },
    [listeners, active, onOpen, task.id],
  )
  const handleClick = useCallback(() => onOpen(task.id), [onOpen, task.id])

  // The same style object until the card actually moves, so the memoized Card can skip rendering
  // while a drag elsewhere in the column re-renders this component
  const transformCss = CSS.Translate.toString(transform)
  const style = useMemo(() => ({ transform: transformCss, transition }), [transformCss, transition])

  return (
    <Card
      ref={setNodeRef}
      task={task}
      search={search}
      // While dragging, the card left in the list becomes the "it will land here" slot;
      // the card under the pointer is a copy rendered in Board's DragOverlay
      className={isDragging ? 'card-placeholder' : undefined}
      style={style}
      {...attributes}
      {...listeners}
      aria-haspopup="dialog"
      // A click right after a drag is swallowed by dnd-kit, so this only fires for real clicks
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  )
}

export default memo(SortableCard)
