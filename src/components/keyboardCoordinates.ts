import type { DroppableContainer, KeyboardCoordinateGetter } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Keyboard moves for the board. Where the cards in a column run top to bottom (Grid and
 * Column views):
 * - ↑/↓ reorder within the card's current column
 * - ←/→ go to the previous/next column in board order, next to the card at the
 *   same height, or into the column itself when it's empty
 * Where they run left to right (Row view, one lane per column) the keys swap:
 * ←/→ reorder within the lane, ↑/↓ go to the previous/next lane.
 *
 * dnd-kit's default jumps to whichever drop target is nearest in the pressed
 * direction, which could skip a column (an empty column's top is often further
 * away than the cards two columns over). Going by board order also works on the
 * stacked mobile layout, where columns aren't side by side.
 */
function createKeyboardCoordinates(cardsRun: 'vertical' | 'horizontal'): KeyboardCoordinateGetter {
  const [previousColumnKey, nextColumnKey] = cardsRun === 'vertical' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
  return (event, args) => moveCard(event, args, { previousColumnKey, nextColumnKey, cardsRun })
}

/** Grid and Column views */
export const kanbanKeyboardCoordinates = createKeyboardCoordinates('vertical')
/** Row view */
export const laneKeyboardCoordinates = createKeyboardCoordinates('horizontal')

function moveCard(
  event: Parameters<KeyboardCoordinateGetter>[0],
  args: Parameters<KeyboardCoordinateGetter>[1],
  { previousColumnKey, nextColumnKey, cardsRun }: { previousColumnKey: string; nextColumnKey: string; cardsRun: 'vertical' | 'horizontal' },
) {
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

  if (event.code === previousColumnKey || event.code === nextColumnKey) {
    const target = columns[currentIndex + (event.code === nextColumnKey ? 1 : -1)]
    if (!target) return undefined

    const cardRects = taskIdsOf(target)
      .filter((taskId) => taskId !== active.id)
      .map((taskId) => droppableRects.get(taskId))
      .filter((rect) => rect !== undefined)
    // Land next to the card at the same height (columns) or the same horizontal spot (lanes)
    const center = (rect: { top: number; left: number; height: number; width: number }) =>
      cardsRun === 'vertical' ? rect.top + rect.height / 2 : rect.left + rect.width / 2
    const distance = (rect: Parameters<typeof center>[0]) => Math.abs(center(rect) - center(collisionRect))
    const landing = cardRects.length
      ? cardRects.reduce((closest, rect) => (distance(rect) < distance(closest) ? rect : closest))
      : droppableRects.get(target.id)
    return landing ? { x: landing.left, y: landing.top } : undefined
  }

  // Within the column: dnd-kit's sortable logic, limited to the cards in the current column
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
