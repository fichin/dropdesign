import type { DroppableContainer, KeyboardCoordinateGetter } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Keyboard moves for the board:
 * - ↑/↓ reorder within the card's current column
 * - ←/→ go to the previous/next column in board order, next to the card at the
 *   same height, or into the column itself when it's empty
 *
 * dnd-kit's default jumps to whichever drop target is nearest in the pressed
 * direction, which could skip a column (an empty column's top is often further
 * away than the cards two columns over). Going by board order also works on the
 * stacked mobile layout, where columns aren't side by side.
 */
export const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, collisionRect, droppableContainers, droppableRects } = args.context
  if (!active || !collisionRect) return undefined

  const taskIdsOf = (container: DroppableContainer) =>
    container.data.current?.taskIds as string[]
  const columns = droppableContainers
    .getEnabled()
    .filter((container) => container.data.current?.type === 'column')
    .sort((a, b) => documentOrder(a.node.current, b.node.current))
  const currentIndex = columns.findIndex((column) => taskIdsOf(column).includes(String(active.id)))
  if (currentIndex === -1) return undefined

  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    const target = columns[currentIndex + (event.code === 'ArrowRight' ? 1 : -1)]
    if (!target) return undefined

    const cardRects = taskIdsOf(target)
      .filter((taskId) => taskId !== active.id)
      .map((taskId) => droppableRects.get(taskId))
      .filter((rect) => rect !== undefined)
    const centerY = collisionRect.top + collisionRect.height / 2
    const distance = (rect: { top: number; height: number }) =>
      Math.abs(rect.top + rect.height / 2 - centerY)
    const landing = cardRects.length
      ? cardRects.reduce((closest, rect) => (distance(rect) < distance(closest) ? rect : closest))
      : droppableRects.get(target.id)
    return landing ? { x: landing.left, y: landing.top } : undefined
  }

  // ↑/↓: dnd-kit's sortable logic, limited to the cards in the current column
  const current = columns[currentIndex]
  const sameColumnCards = new Set(taskIdsOf(current).filter((taskId) => taskId !== active.id))
  // sortableKeyboardCoordinates only calls get() and getEnabled() on this map
  const restricted = {
    get: (id: Parameters<typeof droppableContainers.get>[0]) => droppableContainers.get(id),
    getEnabled: () =>
      droppableContainers.getEnabled().filter((container) => sameColumnCards.has(String(container.id))),
  } as unknown as typeof droppableContainers

  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableContainers: restricted },
  })
}

function documentOrder(a: Node | null, b: Node | null) {
  if (!a || !b) return 0
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}
