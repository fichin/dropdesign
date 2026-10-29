import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { memo, useState } from 'react'
import { boardReducer, findColumnId } from '../state/boardReducer'
import type { Board as BoardType, Task } from '../../shared/kanban.ts'
import Card from './Card'
import Column from './Column'
import { kanbanKeyboardCoordinates, laneKeyboardCoordinates } from './keyboardCoordinates'
import './Board.css'

interface BoardProps {
  board: BoardType
  /** Showing a cached copy (offline or still connecting): no dragging or adding */
  readOnly: boolean
  onAddTask: (columnId: string, title: string) => void
  onMoveTask: (taskId: string, toColumnId: string, toIndex: number) => void
  onOpenTask: (taskId: string) => void
  /**
   * Search/filters: only tasks this returns true for are shown. It only affects rendering;
   * drag-and-drop still works out positions against each column's full task list.
   */
  isVisible?: (task: Task) => boolean
  filtering?: boolean
  /** Lowercased search text to highlight in card titles */
  search?: string
  /**
   * grid: columns side by side (stacked on phones); column: always stacked, full width;
   * row: each column is a horizontal lane with its cards in a row
   */
  layout?: BoardLayout
}

export type BoardLayout = 'grid' | 'column' | 'row'

const showAll = () => true

// Enter is left free so it can open a card's details
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space'] }

// Sensor options live outside the component: useSensor memoizes on the options object, and a new
// one on every render would rebuild dnd-kit's context and re-render every card on the board.
// A few pixels of movement before a drag starts, so plain clicks still work
const MOUSE_OPTIONS = { activationConstraint: { distance: 5 } }
// Press and hold on touch screens, so swiping still scrolls the page
const TOUCH_OPTIONS = { activationConstraint: { delay: 250, tolerance: 8 } }
// Space to pick up, arrow keys to move, Space to drop, Esc to cancel
const KEYBOARD_OPTIONS = {
  vertical: { coordinateGetter: kanbanKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES },
  horizontal: { coordinateGetter: laneKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES },
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Press Enter to open the task details. To move the task, press Space to pick it up, ' +
    'use the arrow keys to move it, then press Space to drop it or Escape to cancel.',
}

function Board({
  board,
  readOnly,
  onAddTask,
  onMoveTask,
  onOpenTask,
  isVisible = showAll,
  filtering = false,
  search = '',
  layout = 'grid',
}: BoardProps) {
  const cardsRun = layout === 'row' ? 'horizontal' : 'vertical'
  // While dragging, cards are rearranged in this preview copy so the lists make room
  // as you go. The real board only receives a single moveTask on drop, and cancelling
  // (Esc, or dropping outside every column) just discards the preview.
  const [preview, setPreview] = useState<BoardType | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const shown = preview ?? board

  const sensors = useSensors(
    useSensor(MouseSensor, MOUSE_OPTIONS),
    useSensor(TouchSensor, TOUCH_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_OPTIONS[cardsRun]),
  )

  function resetDrag() {
    setPreview(null)
    setActiveTaskId(null)
    setOverColumnId(null)
  }

  function handleDragStart({ active }: DragStartEvent) {
    const taskId = String(active.id)
    setPreview(board)
    setActiveTaskId(taskId)
    setOverColumnId(findColumnId(board, taskId) ?? null)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) {
      setOverColumnId(null)
      return
    }
    const taskId = String(active.id)
    const overId = String(over.id)
    setOverColumnId(findColumnId(shown, overId) ?? null)

    // Reordering inside a column is animated by dnd-kit itself; only a change of
    // column needs the preview updated so the new column opens a gap
    setPreview((current) => {
      if (!current) return current
      const fromColumnId = findColumnId(current, taskId)
      const toColumnId = findColumnId(current, overId)
      if (!fromColumnId || !toColumnId || fromColumnId === toColumnId) return current

      const toTaskIds = current.columns[toColumnId].taskIds
      let toIndex = toTaskIds.length
      if (overId !== toColumnId) {
        // Over a card: go before or after it depending on which half the dragged card is over
        // (top/bottom half in columns, left/right half in Row view lanes)
        const dragged = active.rect.current.translated
        const isAfter =
          cardsRun === 'horizontal'
            ? (dragged?.left ?? 0) > over.rect.left + over.rect.width / 2
            : (dragged?.top ?? 0) > over.rect.top + over.rect.height / 2
        toIndex = toTaskIds.indexOf(overId) + (isAfter ? 1 : 0)
      }
      return boardReducer(current, { type: 'moveTask', taskId, toColumnId, toIndex })
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = preview
    resetDrag()
    if (!over || !current) return

    const taskId = String(active.id)
    const overId = String(over.id)
    const toColumnId = findColumnId(current, overId)
    if (!toColumnId) return

    const toTaskIds = current.columns[toColumnId].taskIds
    // Dropped on a card: take its place. Dropped on the column itself: stay where
    // the preview put it, or go to the bottom if it isn't in this column yet.
    const overIndex = toTaskIds.indexOf(overId === toColumnId ? taskId : overId)
    const toIndex = overIndex === -1 ? toTaskIds.length : overIndex
    onMoveTask(taskId, toColumnId, toIndex)
  }

  const taskTitle = (id: UniqueIdentifier) => `"${board.tasks[String(id)]?.title ?? 'task'}"`
  const columnTitle = (id: UniqueIdentifier) => {
    const columnId = findColumnId(shown, String(id))
    return columnId ? shown.columns[columnId].title : 'no column'
  }

  // What screen readers hear; the defaults would read out internal ids
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up task ${taskTitle(active.id)} in ${columnTitle(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Task ${taskTitle(active.id)} is over ${columnTitle(over.id)}.`
        : `Task ${taskTitle(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped task ${taskTitle(active.id)} in ${columnTitle(over.id)}.`
        : `Task ${taskTitle(active.id)} was returned to where it started.`,
    onDragCancel: ({ active }) =>
      `Moving cancelled. Task ${taskTitle(active.id)} was returned to where it started.`,
  }

  const activeTask = activeTaskId ? board.tasks[activeTaskId] : null
  const overlayStatus = overColumnId ? shown.columns[overColumnId].status : undefined

  return (
    <div className={`board-page board-${layout}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDrag}
      >
        <div className="board">
          {shown.columnOrder.map((columnId) => {
            const column = shown.columns[columnId]
            const tasks = column.taskIds.map((taskId) => shown.tasks[taskId]).filter(isVisible)
            return (
              <Column
                key={column.id}
                column={column}
                tasks={tasks}
                filtering={filtering}
                search={search}
                isDropTarget={overColumnId === column.id}
                readOnly={readOnly}
                onAddTask={onAddTask}
                onOpenTask={onOpenTask}
                orientation={cardsRun}
              />
            )
          })}
        </div>

        {/* The card that follows the pointer; data-status tints its progress bar
            with the colour of the column it's currently over */}
        <DragOverlay>
          {activeTask && (
            <div className="drag-overlay" data-status={overlayStatus}>
              <Card task={activeTask} search={search} className="card-overlay" />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// Memoized so that state elsewhere on the screen (the open task, the filter menus) doesn't
// re-render the board; BoardScreen passes it stable callbacks for this
export default memo(Board)
