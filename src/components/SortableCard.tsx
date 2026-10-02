import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types/kanban'
import Card from './Card'

interface SortableCardProps {
  task: Task
}

function SortableCard({ task }: SortableCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <Card
      ref={setNodeRef}
      task={task}
      // While dragging, the card left in the list becomes the "it will land here" slot;
      // the card under the pointer is a copy rendered in Board's DragOverlay
      className={isDragging ? 'card-placeholder' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    />
  )
}

export default SortableCard
