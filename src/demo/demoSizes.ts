import type { BoardView } from '../state/boardView'

/** The "Load" buttons */
export const LOAD_SIZES = [1000, 5000, 10000]

/**
 * Views that still render every card, and the most tasks the demo shows in them. Above that a
 * board of full cards gets slow enough to freeze weaker laptops. Remove a view from here once it
 * is virtualized (the Column and List views have no limit)
 */
export const UNVIRTUALIZED_VIEW_LIMITS: Partial<Record<BoardView, number>> = { grid: 1000, row: 1000 }

export const isCapped = (view: BoardView, taskCount: number) =>
  taskCount > (UNVIRTUALIZED_VIEW_LIMITS[view] ?? Infinity)
