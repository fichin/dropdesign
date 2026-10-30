import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual'
import { useCallback, useRef } from 'react'
import type { Task } from '../../shared/kanban.ts'
import SortableCard from './SortableCard'
import { useScrollMargin } from './useScrollMargin'
import { withPinned } from './withPinned'

/**
 * In the Column view, a column with more tasks than this renders only the cards near the
 * screen (VirtualCards). It counts the column's tasks on the board, not the drag preview or the
 * filtered list, so a column never switches modes mid-drag or while typing a search.
 * Shorter columns render every card, exactly as before.
 */
export const VIRTUALIZE_COLUMN_FROM = 100

/** Height of a card before it has been measured (Column-view cards measure 172-193px) */
const ESTIMATED_CARD_HEIGHT = 180
/** The gap between cards, as in .column-tasks */
const CARD_GAP = 10

interface VirtualCardsProps {
  /** The column's shown cards, in order: all of them are in SortableContext's items */
  tasks: Task[]
  /** The card being dragged, if it's in this column: it must stay in the page for dnd-kit */
  activeTaskId: string | null
  readOnly: boolean
  onOpenTask: (taskId: string) => void
  search: string
}

/**
 * A long column's cards: only those on screen (plus a few either side) are in the page, each
 * placed at its offset in a list as tall as all of them, so the page scrolls as usual.
 */
function VirtualCards({ tasks, activeTaskId, readOnly, onOpenTask, search }: VirtualCardsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const scrollMargin = useScrollMargin(listRef)
  const activeIndex = activeTaskId === null ? -1 : tasks.findIndex((task) => task.id === activeTaskId)

  const getItemKey = useCallback((index: number) => tasks[index].id, [tasks])
  const rangeExtractor = useCallback(
    (range: Range) => withPinned(defaultRangeExtractor(range), [activeIndex], range.count),
    [activeIndex],
  )
  // The rule is about the React Compiler (not used here) memoizing a component that holds the
  // virtualizer's functions; the only one passed on, measureElement, goes to a plain div
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useWindowVirtualizer({
    count: tasks.length,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    gap: CARD_GAP,
    overscan: 10,
    scrollMargin,
    getItemKey,
    rangeExtractor,
  })

  return (
    <div ref={listRef} className="column-virtual-list" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          ref={virtualizer.measureElement}
          data-index={item.index}
          className="column-virtual-item"
          style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
        >
          <SortableCard task={tasks[item.index]} disabled={readOnly} onOpen={onOpenTask} search={search} />
        </div>
      ))}
    </div>
  )
}

export default VirtualCards
