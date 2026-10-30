import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual'
import { useCallback, useRef, useState } from 'react'
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
  // The card that last had focus, so it stays in the page when it scrolls away
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null)
  const indexOf = (taskId: string | null) => (taskId === null ? -1 : tasks.findIndex((task) => task.id === taskId))
  const activeIndex = indexOf(activeTaskId)
  const focusedIndex = indexOf(focusedTaskId)

  const getItemKey = useCallback((index: number) => tasks[index].id, [tasks])
  // Cards kept in the page wherever they are, so the column behaves as if every card were there:
  // - the dragged card: dnd-kit needs it for the whole drag
  // - the first and last: where ← and → from a neighbouring column land (keyboardCoordinates.ts),
  //   and where Tab and Shift+Tab enter the column
  // - the focused card and its neighbours: focus isn't lost when it scrolls away, and Tab and
  //   Shift+Tab move to the card next to it rather than to whatever else is in the page
  const lastIndex = tasks.length - 1
  const rangeExtractor = useCallback(
    (range: Range) =>
      withPinned(
        defaultRangeExtractor(range),
        [activeIndex, 0, lastIndex, focusedIndex - 1, focusedIndex, focusedIndex === -1 ? -1 : focusedIndex + 1],
        range.count,
      ),
    [activeIndex, lastIndex, focusedIndex],
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
    <div
      ref={listRef}
      className="column-virtual-list"
      style={{ height: virtualizer.getTotalSize() }}
      onFocus={(event) => {
        const index = Number((event.target as HTMLElement).closest<HTMLElement>('[data-index]')?.dataset.index)
        if (Number.isInteger(index)) setFocusedTaskId(tasks[index].id)
      }}
    >
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
