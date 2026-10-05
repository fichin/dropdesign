import { useCallback, useState } from 'react'

/** The four ways to look at the board (the header's view switcher) */
export const BOARD_VIEWS = ['grid', 'list', 'column', 'row'] as const
export type BoardView = (typeof BOARD_VIEWS)[number]

/** Id of a view's tab in the header, which labels the view panel */
export const viewTabId = (view: BoardView) => `view-tab-${view}`

const STORAGE_KEY = 'board-view'
const isBoardView = (value: unknown): value is BoardView => BOARD_VIEWS.includes(value as BoardView)

function savedView(): BoardView {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isBoardView(value) ? value : 'grid'
  } catch {
    return 'grid'
  }
}

/** The chosen view, remembered across reloads like the theme (per browser, not per account) */
export function useBoardView() {
  const [view, setViewState] = useState<BoardView>(savedView)

  const setView = useCallback((next: BoardView) => {
    setViewState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the view still changes, it just isn't remembered
    }
  }, [])

  return [view, setView] as const
}
