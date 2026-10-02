import type { DroppableContainer, KeyboardCoordinateGetter } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Arrow keys jump to the nearest drop target in that direction. A column's own drop
 * zone is wider than its cards, so it can win over the cards in the next column and
 * the card never leaves (e.g. ← from Completed stayed in Completed). Hiding drop zones
 * of columns that still have cards keeps arrow keys moving card to card, while an
 * empty column can still be reached.
 */
export const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, droppableContainers } = args.context
  const isColumnWithCards = (container: DroppableContainer) => {
    const data = container.data.current
    if (data?.type !== 'column') return false
    return (data.taskIds as string[]).some((taskId) => taskId !== active?.id)
  }

  // sortableKeyboardCoordinates only calls get() and getEnabled() on this map
  const cardTargetsOnly = {
    get: (id: Parameters<typeof droppableContainers.get>[0]) => droppableContainers.get(id),
    getEnabled: () => droppableContainers.getEnabled().filter((c) => !isColumnWithCards(c)),
  } as unknown as typeof droppableContainers

  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableContainers: cardTargetsOnly },
  })
}
